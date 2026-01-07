use image::{DynamicImage, ImageFormat};
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

/// Resize image to target file size
/// Uses binary search on JPEG quality to hit target size
///
/// # Arguments
/// * `data` - Input image bytes
/// * `target_bytes` - Target file size in bytes
/// * `floor_quality` - Minimum JPEG quality (default 30)
/// * `ceil_quality` - Maximum JPEG quality (default 95)
/// * `tolerance_percent` - Acceptable deviation from target (default 5%)
#[wasm_bindgen]
pub fn resize_by_filesize(
    data: &[u8],
    target_bytes: u32,
    floor_quality: Option<u8>,
    ceil_quality: Option<u8>,
    _tolerance_percent: Option<f32>,
) -> Result<Vec<u8>, JsValue> {
    let img = load_image(data)?;

    let floor = floor_quality.unwrap_or(30).max(1).min(100);
    let ceil = ceil_quality.unwrap_or(95).max(floor).min(100);

    // Binary search for the right quality
    let mut low = floor;
    let mut high = ceil;
    let mut best_under: Option<Vec<u8>> = None;
    let mut best_under_diff = u32::MAX;
    let mut best_result: Option<Vec<u8>> = None;
    let mut best_diff = u32::MAX;

    while low <= high {
        let mid = (low + high) / 2;

        match encode_image(&img, InternalOutputFormat::Jpeg(mid)) {
            Ok(encoded) => {
                let size = encoded.len() as u32;
                let diff = if size > target_bytes {
                    size - target_bytes
                } else {
                    target_bytes - size
                };

                // Track best result overall (closest to target)
                if diff < best_diff {
                    best_diff = diff;
                    best_result = Some(encoded.clone());
                }

                // Track best under-target result
                if size <= target_bytes && diff < best_under_diff {
                    best_under_diff = diff;
                    best_under = Some(encoded.clone());
                }

                // Adjust search range
                if size > target_bytes {
                    high = mid.saturating_sub(1);
                } else {
                    low = mid + 1;
                }
            }
            Err(e) => return Err(e),
        }

        // Prevent infinite loop
        if low == high {
            break;
        }
    }

    // Prefer under-target result; fall back to lowest-quality overshoot if necessary
    best_under
        .or(best_result)
        .ok_or_else(|| JsValue::from_str("Failed to encode image at any quality level"))
}

// ============================================================================
// Internal helper functions
// ============================================================================

fn load_image(data: &[u8]) -> Result<DynamicImage, JsValue> {
    image::load_from_memory(data)
        .map_err(|e| JsValue::from_str(&format!("Failed to decode image: {}", e)))
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
