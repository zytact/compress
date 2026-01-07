'use client'

import { useCallback, useRef, useState } from 'react'
import { FileDropzone } from './file-drop-zone'
import { ModeTabs } from './mode-tabs'
import { DimensionsSettings } from './dimension-settings'
import { FilesizeSettings } from './file-size-settings'
import { PrimaryAction } from './primary-action'
import { ErrorBanner } from './error-banner'
import { PreviewPane } from './preview-pane'
import type { ImageInfo } from '@/lib/wasm'
import {
    OutputFormat,
    fileToUint8Array,
    getImageDimensionsFromUrl,
    getMimeType,
    inferFormatFromFilename,
    resizeByDimensions,
    resizeByFilesize,
    uint8ArrayToBlob,
} from '@/lib/wasm'
