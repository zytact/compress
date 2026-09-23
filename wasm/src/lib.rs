use image::imageops::FilterType;
use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader, RgbImage};
use std::io::Cursor;
use std::rc::Rc;
use wasm_bindgen::prelude::*;

// Set up better panic messages for debugging
#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
#[derive(Clone, Copy)]
pub enum OutputFormat {
    Jpeg,
    Png,
    Original,
}

#[derive(Clone, Copy)]
enum InternalOutputFormat {
    Jpeg(u8),
    Png,
}

const DEFAULT_QUALITY: u8 = 85;

/// Encoded bytes together with the dimensions they were encoded at, so the
/// caller never has to decode the output again to measure it.
#[wasm_bindgen]
pub struct EncodedImage {
    data: Vec<u8>,
    width: u32,
    height: u32,
}

#[wasm_bindgen]
impl EncodedImage {
    #[wasm_bindgen(getter)]
    pub fn data(&self) -> Vec<u8> {
        self.data.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.width
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.height
    }
}

/// An [`EncodedImage`] plus the JPEG quality the search settled on.
#[wasm_bindgen]
pub struct FitResult {
    data: Vec<u8>,
    width: u32,
    height: u32,
    quality: u8,
}

#[wasm_bindgen]
impl FitResult {
    #[wasm_bindgen(getter)]
    pub fn data(&self) -> Vec<u8> {
        self.data.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.width
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.height
    }

    #[wasm_bindgen(getter)]
    pub fn quality(&self) -> u8 {
        self.quality
    }
}

/// One decoded image, encoded as many times as the user edits.
///
/// Decoding and resizing cost far more than encoding, so both are done once and
/// held here: changing only the quality re-encodes cached pixels. Hold one of
/// these per image the user picks and `free()` it when they pick another.
#[wasm_bindgen]
pub struct ImageSource {
    decoded: Rc<DynamicImage>,
    source_format: Option<ImageFormat>,
    prepared: Option<Prepared>,
}

/// A rectangle of the source in source pixels, which is all that gets encoded.
#[wasm_bindgen]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Crop {
    x: u32,
    y: u32,
    width: u32,
    height: u32,
}

#[wasm_bindgen]
impl Crop {
    #[wasm_bindgen(constructor)]
    pub fn new(x: u32, y: u32, width: u32, height: u32) -> Crop {
        Crop {
            x,
            y,
            width,
            height,
        }
    }
}

impl Crop {
    fn covers(&self, image: &DynamicImage) -> bool {
        *self
            == Crop {
                x: 0,
                y: 0,
                width: image.width(),
                height: image.height(),
            }
    }

    fn fits_in(&self, image: &DynamicImage) -> bool {
        self.width > 0
            && self.height > 0
            && self
                .x
                .checked_add(self.width)
                .is_some_and(|r| r <= image.width())
            && self
                .y
                .checked_add(self.height)
                .is_some_and(|b| b <= image.height())
    }
}

/// The source at one crop and output size, kept until a different one is asked for.
struct Prepared {
    crop: Crop,
    width: u32,
    height: u32,
    image: Rc<DynamicImage>,
    /// Set only when `image` is not already RGB8, which is what JPEG needs.
    converted_rgb: Option<RgbImage>,
}

#[wasm_bindgen]
impl ImageSource {
    #[wasm_bindgen(constructor)]
    pub fn new(data: &[u8]) -> Result<ImageSource, JsValue> {
        Ok(ImageSource {
            decoded: Rc::new(load_image(data)?),
            source_format: image::guess_format(data).ok(),
            prepared: None,
        })
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.decoded.width()
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.decoded.height()
    }

    /// Crop to a region of the source, then encode it at an exact size.
    ///
    /// # Arguments
    /// * `crop` - Region of the source to keep
    /// * `width` - Target width
    /// * `height` - Target height
    /// * `format` - Output format (Jpeg, Png, Original)
    /// * `quality` - JPEG quality 1-100 (optional, default 85)
    pub fn encode(
        &mut self,
        crop: Crop,
        width: u32,
        height: u32,
        format: OutputFormat,
        quality: Option<u8>,
    ) -> Result<EncodedImage, JsValue> {
        let output = self.resolve_format(format, quality.unwrap_or(DEFAULT_QUALITY));
        let data = self.prepare(crop, width, height)?.encode(output)?;

        Ok(EncodedImage {
            data,
            width,
            height,
        })
    }

    /// Encode at the highest JPEG quality that still lands under `target_bytes`.
    ///
    /// Crops and resizes once up front so a target size and a target width can
    /// be asked for together, then binary searches quality over the result.
    ///
    /// # Arguments
    /// * `crop` - Region of the source to keep
    /// * `width` - Target width
    /// * `height` - Target height
    /// * `target_bytes` - Size the output must stay under
    /// * `floor_quality` - Minimum JPEG quality (default 30)
    /// * `ceil_quality` - Maximum JPEG quality (default 95)
    pub fn fit_to_filesize(
        &mut self,
        crop: Crop,
        width: u32,
        height: u32,
        target_bytes: u32,
        floor_quality: Option<u8>,
        ceil_quality: Option<u8>,
    ) -> Result<FitResult, JsValue> {
        let floor = floor_quality.unwrap_or(30).clamp(1, 100);
        let ceil = ceil_quality.unwrap_or(95).clamp(floor, 100);
        let prepared = self.prepare(crop, width, height)?;

        let mut under: Option<(Vec<u8>, u8)> = None;
        let mut smallest: Option<(Vec<u8>, u8)> = None;

        let mut low = floor;
        let mut high = ceil;

        while low <= high {
            let mid = low + (high - low) / 2;
            let encoded = prepared.encode(InternalOutputFormat::Jpeg(mid))?;

            if encoded.len() as u32 <= target_bytes {
                under = Some((encoded, mid));
                low = mid + 1;
            } else {
                let beats_smallest = match &smallest {
                    Some((best, _)) => encoded.len() < best.len(),
                    None => true,
                };
                if beats_smallest {
                    smallest = Some((encoded, mid));
                }
                high = mid.saturating_sub(1);
            }
        }

        under
            .or(smallest)
            .map(|(data, quality)| FitResult {
                data,
                width,
                height,
                quality,
            })
            .ok_or_else(|| JsValue::from_str("Failed to encode image at any quality level"))
    }
}

impl ImageSource {
    /// Crops and resizes to `width` x `height` unless that is already cached.
    fn prepare(&mut self, crop: Crop, width: u32, height: u32) -> Result<&mut Prepared, JsValue> {
        if width == 0 || height == 0 {
            return Err(JsValue::from_str(
                "Target dimensions must be greater than 0",
            ));
        }
        if !crop.fits_in(&self.decoded) {
            return Err(JsValue::from_str("Crop must lie inside the image"));
        }

        let cached = matches!(&self.prepared, Some(p) if p.crop == crop && p.width == width && p.height == height);
        if !cached {
            let image = if crop.covers(&self.decoded)
                && width == self.decoded.width()
                && height == self.decoded.height()
            {
                Rc::clone(&self.decoded)
            } else {
                Rc::new(render(&self.decoded, crop, width, height))
            };
            self.prepared = Some(Prepared {
                crop,
                width,
                height,
                image,
                converted_rgb: None,
            });
        }

        Ok(self
            .prepared
            .as_mut()
            .expect("prepared is set above when it does not match"))
    }

    fn resolve_format(&self, format: OutputFormat, quality: u8) -> InternalOutputFormat {
        match format {
            OutputFormat::Jpeg => InternalOutputFormat::Jpeg(quality),
            OutputFormat::Png => InternalOutputFormat::Png,
            OutputFormat::Original => match self.source_format {
                Some(ImageFormat::Png) => InternalOutputFormat::Png,
                // Every format the encoder cannot emit falls back to JPEG
                _ => InternalOutputFormat::Jpeg(quality),
            },
        }
    }
}

impl Prepared {
    fn encode(&mut self, format: InternalOutputFormat) -> Result<Vec<u8>, JsValue> {
        let mut buffer = Cursor::new(Vec::new());

        match format {
            InternalOutputFormat::Jpeg(quality) => {
                let rgb = self.rgb();
                let mut encoder =
                    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buffer, quality);
                encoder
                    .encode(
                        rgb.as_raw(),
                        rgb.width(),
                        rgb.height(),
                        image::ExtendedColorType::Rgb8,
                    )
                    .map_err(|e| JsValue::from_str(&format!("JPEG encode failed: {}", e)))?;
            }
            InternalOutputFormat::Png => {
                self.image
                    .write_to(&mut buffer, ImageFormat::Png)
                    .map_err(|e| JsValue::from_str(&format!("PNG encode failed: {}", e)))?;
            }
        }

        Ok(buffer.into_inner())
    }

    /// The RGB view JPEG encoding needs, converted at most once per size.
    fn rgb(&mut self) -> &RgbImage {
        if self.converted_rgb.is_none() && self.image.as_rgb8().is_none() {
            self.converted_rgb = Some(self.image.to_rgb8());
        }

        self.converted_rgb.as_ref().unwrap_or_else(|| {
            self.image
                .as_rgb8()
                .expect("image is RGB8 when no conversion was needed")
        })
    }
}

/// Cuts `crop` out of the source and scales it to exactly `width` x `height`.
fn render(source: &DynamicImage, crop: Crop, width: u32, height: u32) -> DynamicImage {
    let cropped =
        (!crop.covers(source)).then(|| source.crop_imm(crop.x, crop.y, crop.width, crop.height));
    let region = cropped.as_ref().unwrap_or(source);

    if region.width() == width && region.height() == height {
        cropped.unwrap_or_else(|| source.clone())
    } else {
        region.resize_exact(width, height, FilterType::Lanczos3)
    }
}

/// Decodes an image and bakes its EXIF orientation into the pixels, so the
/// dimensions here match the upright ones the browser reports to the caller.
fn load_image(data: &[u8]) -> Result<DynamicImage, JsValue> {
    let decode = || -> Result<DynamicImage, image::ImageError> {
        let mut decoder = ImageReader::new(Cursor::new(data))
            .with_guessed_format()?
            .into_decoder()?;
        let orientation = decoder.orientation()?;
        let mut img = DynamicImage::from_decoder(decoder)?;
        img.apply_orientation(orientation);
        Ok(img)
    };

    decode().map_err(|e| JsValue::from_str(&format!("Failed to decode image: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 400x200 landscape pixels tagged Orientation=6, so it is upright at
    /// 200x400: red on top, blue below. iPhone photos arrive exactly like this.
    const ORIENTATION_6: &[u8] = include_bytes!("../tests/fixtures/orientation-6.jpg");

    #[test]
    fn decoding_applies_exif_orientation() {
        let img = load_image(ORIENTATION_6).expect("fixture decodes");

        assert_eq!((img.width(), img.height()), (200, 400));

        let rgb = img.to_rgb8();
        let top = rgb.get_pixel(100, 50).0;
        let bottom = rgb.get_pixel(100, 350).0;
        assert!(
            top[0] > 200 && top[2] < 60,
            "top half should be red: {top:?}"
        );
        assert!(
            bottom[2] > 200 && bottom[0] < 60,
            "bottom half should be blue: {bottom:?}"
        );
    }

    #[test]
    fn render_keeps_only_the_cropped_region() {
        // Left half red, right half blue
        let source = DynamicImage::ImageRgb8(RgbImage::from_fn(40, 20, |x, _| {
            if x < 20 {
                image::Rgb([255, 0, 0])
            } else {
                image::Rgb([0, 0, 255])
            }
        }));
        let right = Crop {
            x: 20,
            y: 0,
            width: 20,
            height: 20,
        };

        let out = render(&source, right, 10, 10).to_rgb8();

        assert_eq!(out.dimensions(), (10, 10));
        assert!(out.pixels().all(|p| p.0[2] > 200 && p.0[0] < 60));
    }

    #[test]
    fn crop_must_fit_inside_the_source() {
        let source = DynamicImage::new_rgb8(40, 20);
        let crop = |x, y, width, height| Crop {
            x,
            y,
            width,
            height,
        };

        assert!(crop(0, 0, 40, 20).fits_in(&source));
        assert!(!crop(1, 0, 40, 20).fits_in(&source));
        assert!(!crop(0, 0, 0, 20).fits_in(&source));
        assert!(!crop(u32::MAX, 0, 2, 20).fits_in(&source));
    }
}
