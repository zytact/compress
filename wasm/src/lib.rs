use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader};
use std::io::Cursor;
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

/// Resize image by exact dimensions
///
/// # Arguments
/// * `data` - Input image bytes
/// * `width` - Target width
/// * `height` - Target height
/// * `format` - Output format (Jpeg, Png, Original)
/// * `quality` - JPEG quality 1-100 (optional, default 85)
#[wasm_bindgen]
pub fn resize_by_dimensions(
    data: &[u8],
    width: u32,
    height: u32,
    format: OutputFormat,
    quality: Option<u8>,
) -> Result<Vec<u8>, JsValue> {
    let img = load_image(data)?;
    let (orig_width, orig_height) = (img.width(), img.height());

    // Skip resize if dimensions match original
    let resized = if width == orig_width && height == orig_height {
        img
    } else {
        resize_image(&img, width, height)?
    };

    let output_format = determine_output_format(format, data, quality.unwrap_or(85));
    encode_image(&resized, output_format)
}

#[wasm_bindgen]
pub struct FitResult {
    data: Vec<u8>,
    quality: u8,
}

#[wasm_bindgen]
impl FitResult {
    #[wasm_bindgen(getter)]
    pub fn data(&self) -> Vec<u8> {
        self.data.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn quality(&self) -> u8 {
        self.quality
    }
}

/// Encode at the highest JPEG quality that still lands under `target_bytes`.
///
/// Resizes once up front so a target size and a target width can be asked for
/// together, then binary searches quality over the resized image.
///
/// # Arguments
/// * `data` - Input image bytes
/// * `width` - Target width
/// * `height` - Target height
/// * `target_bytes` - Size the output must stay under
/// * `floor_quality` - Minimum JPEG quality (default 30)
/// * `ceil_quality` - Maximum JPEG quality (default 95)
#[wasm_bindgen]
pub fn fit_to_filesize(
    data: &[u8],
    width: u32,
    height: u32,
    target_bytes: u32,
    floor_quality: Option<u8>,
    ceil_quality: Option<u8>,
) -> Result<FitResult, JsValue> {
    let img = load_image(data)?;
    let resized = if width == img.width() && height == img.height() {
        img
    } else {
        resize_image(&img, width, height)?
    };

    let floor = floor_quality.unwrap_or(30).clamp(1, 100);
    let ceil = ceil_quality.unwrap_or(95).clamp(floor, 100);

    let mut under: Option<(Vec<u8>, u8)> = None;
    let mut smallest: Option<(Vec<u8>, u8)> = None;

    let mut low = floor;
    let mut high = ceil;

    while low <= high {
        let mid = low + (high - low) / 2;
        let encoded = encode_image(&resized, InternalOutputFormat::Jpeg(mid))?;

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
        .map(|(data, quality)| FitResult { data, quality })
        .ok_or_else(|| JsValue::from_str("Failed to encode image at any quality level"))
}

// ============================================================================
// Internal helper functions
// ============================================================================

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

fn resize_image(img: &DynamicImage, width: u32, height: u32) -> Result<DynamicImage, JsValue> {
    if width == 0 || height == 0 {
        return Err(JsValue::from_str(
            "Target dimensions must be greater than 0",
        ));
    }

    Ok(img.resize_exact(width, height, image::imageops::FilterType::Lanczos3))
}

fn encode_image(img: &DynamicImage, format: InternalOutputFormat) -> Result<Vec<u8>, JsValue> {
    let mut buffer = Cursor::new(Vec::new());

    match format {
        InternalOutputFormat::Jpeg(quality) => {
            let rgb = img.to_rgb8();
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
            img.write_to(&mut buffer, ImageFormat::Png)
                .map_err(|e| JsValue::from_str(&format!("PNG encode failed: {}", e)))?;
        }
    }

    Ok(buffer.into_inner())
}

fn determine_output_format(
    format: OutputFormat,
    original_data: &[u8],
    quality: u8,
) -> InternalOutputFormat {
    match format {
        OutputFormat::Jpeg => InternalOutputFormat::Jpeg(quality),
        OutputFormat::Png => InternalOutputFormat::Png,
        OutputFormat::Original => {
            // Try to detect original format
            match image::guess_format(original_data) {
                Ok(ImageFormat::Jpeg) => InternalOutputFormat::Jpeg(quality),
                Ok(ImageFormat::Png) => InternalOutputFormat::Png,
                _ => InternalOutputFormat::Jpeg(quality), // Default to JPEG
            }
        }
    }
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
}
