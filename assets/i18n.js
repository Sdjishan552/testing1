/* ============================================================
   DocStitcher i18n — English / Hindi / Bengali
   v2.0  —  3-language support with voluntary picker
============================================================ */

const I18N = {
  en: {
    /* ---- Brand / Header ---- */
    brandName:       'Document Stitcher 7.0',
    brandTagline:    'A4 PDF maker · PDF/JPG/PNG output · No uploads · 100% local',
    helpBtn:         'Help',

    /* ---- Help panel ---- */
    helpTitle:  'How to use',
    helpStep1:  'Add a two-sided or one-sided document card using the buttons below.',
    helpStep2:  'Upload front (and back for two-sided). PDFs are auto-converted to images.',
    helpStep3:  'Enable the signature checkbox to add a signature image. Use the 🎯 Place Signature button to position it precisely using arrow keys (hold Shift for bigger steps).',
    helpStep4:  'Click Download and choose PDF, JPG, or PNG output format.',
    helpStep5:  'Use Single-Doc Tools (bottom right) to crop, rotate, flip, compress and convert any image or PDF all at once before sending it here.',

    /* ---- Batch toolbar ---- */
    sectionDocuments: 'Documents',
    toolbarSub:       ' ready · A4 · PDF / JPG / PNG output',
    btnTwoSided:      '+ Two-Sided',
    btnOneSided:      '+ One-Sided',
    btnDownloadAll:   'Download All',

    /* ---- Document card ---- */
    typeLabelTwoSided: 'A4 PDF',
    typeLabelOneSided: 'ONE-SIDED PDF',
    docNameAria:       'Document name',
    removeTitle:       'Remove',
    labelOrientation:  'Orientation',
    optPortrait:       'Portrait',
    optLandscape:      'Landscape',
    labelQuality:      'Quality',
    targetSizePlaceholder: 'Target KB',
    btnSet:            'Set',
    labelDownloadSize: 'Download size',
    previewClickHint:  'click to enlarge',
    previewAltReady:   'Click to preview',
    previewAltWait:    'Upload images to preview',
    sigToggle:         'Add signature image (with keyboard placement)',
    btnDownload:       'Download',
    btnPreview:        'Preview',
    btnClearImages:    'Clear Images',
    btnPlaceSign:      '🎯 Place Signature',

    /* ---- Signature controls ---- */
    labelSigSize: 'Signature size',
    signPresetSmall:  'Small',
    signPresetNormal: 'Normal',
    signPresetLarge:  'Large',
    signPresetXL:     'X-Large',
    signOffsetLabel:  'Position:',
    btnResetOffset:   'Reset',

    /* ---- Slot labels ---- */
    slotFront:        'Front side',
    slotBack:         'Back side',
    slotSign:         'Signature',
    slotBadgeFront:   'FRONT',
    slotBadgeBack:    'BACK',
    dropClickOrDrag:  'Click or drag here',
    dropOptional:     'Optional signature',
    hintImagePdf:     'JPG, PNG, WebP or PDF',
    hintImageOnly:    'JPG, PNG, WebP',
    btnRemoveSlot:    'Remove',
    btnViewSlot:      'View',
    noSignature:      'No signature',
    slotRequired:     'Required',

    /* ---- Estimate texts ---- */
    estimateCalculating: 'Calculating...',
    estimatePending:     'Pending',
    estimateAddFront:    'Add front image',
    estimateAddBoth:     'Add front and back',

    /* ---- Download picker modal ---- */
    dlPickerTitle:  'Choose download format',
    dlPickerAllTitle: 'Choose format for all downloads',
    dlFmtPdfSub:    'A4 print-ready',
    dlFmtJpgSub:    'Smaller file size',
    dlFmtPngSub:    'Lossless quality',
    btnCancel:      'Cancel',

    /* ---- Signature placer modal ---- */
    sigPlacerTitle: '🎯 Place Signature with Arrow Keys',
    sigPlacerHint:  '← → ↑ ↓ to move · Shift + arrows = bigger steps · Enter to confirm · Esc to cancel',
    sigPlacerPos:   'Position:',
    btnConfirmPlacement: '✓ Confirm Placement',

    /* ---- SDT page ---- */
    btnBackToStitcher: 'Back to Stitcher',
    sdtBadge:          'Single-Doc Tools',
    sdtPageTitle:      'Single-Side Tools',
    sdtPageSub:        'Edit image or PDF: crop, rotate, flip, compress, convert — all at once. 100% local.',
    tabMultiTool:      '✨ Multi-Tool Editor',
    tabWatermark:      'Watermark',
    mtCardTitle:       'Multi-Tool Image / PDF Editor',
    mtCardSub:         'Upload one image or PDF and apply crop, rotate, flip, compress & convert — all in one place.',
    mtDropLabel:       'Click or drag image / PDF here',
    mtDropHint:        'JPG, PNG, WebP, PDF supported',
    labelRotateFlip:   'Rotate & Flip',
    btnRotateL:        '↺ 90° Left',
    btnRotateR:        '↻ 90° Right',
    btnRotate180:      '↕ 180°',
    btnFlipH:          '⇆ Flip H',
    btnFlipV:          '⇅ Flip V',
    labelCrop:         'Crop — drag on the image below to select area',
    btnApplyCrop:      '✂ Apply Crop',
    btnClearCrop:      'Clear Crop',
    labelCompressConvert: 'Compress & Convert',
    labelOutputFmt:    'Output Format',
    labelQualMt:       'Quality',
    labelMaxWidth:     'Max Width',
    labelPreviewOut:   'Output Preview',
    btnDownloadMt:     'Download',
    btnSendToStitcher: 'Send to Stitcher',
    btnClearMt:        'Clear',
    wmCardTitle:       'Text Watermark',
    wmDropLabel:       'Click or drag image here',
    wmDropHint:        'Add a custom text watermark',
    labelWmText:       'Watermark Text',
    labelWmPos:        'Position',
    wmPosCenter:       'Center',
    wmPosTile:         'Tiled',
    wmPosTopLeft:      'Top Left',
    wmPosTopRight:     'Top Right',
    wmPosBotLeft:      'Bottom Left',
    wmPosBotRight:     'Bottom Right',
    labelWmSize:       'Font Size',
    labelWmOp:         'Opacity',
    labelWmRot:        'Rotation',
    labelWmColor:      'Colour',
    wmColorPick:       'Pick colour',
    labelWmPreview:    'Preview',
    btnDownloadWm:     'Download',
    btnSendWmToStitcher: 'Send to Stitcher',
    btnClearWm:        'Clear',

    /* ---- Slot picker ---- */
    slotPickerTitle:   'Send to document card',
    slotPickerAddNew:  'Add new document',
    slotBtnFront:      'Front',
    slotBtnBack:       'Back',
    slotBtnSign:       'Sign',

    /* ---- Toast messages (JS) ---- */
    toastKeepOne:        'Keep at least one document card.',
    toastKeepTwo:        'Keep at least two document cards.',
    toastSignSaved:      'Signature position saved!',
    toastSignOnlyImg:    'Signature must be an image (JPG/PNG/WebP).',
    toastSelectImg:      'Please select JPG, PNG, WebP or PDF.',
    toastPdfConverting:  'Converting PDF page to image...',
    toastPdfConverted:   'PDF page converted!',
    toastPdfError:       'Could not read PDF. Try a JPG/PNG instead.',
    toastImageError:     'Could not read image.',
    toastUploadFirst:    'Upload required images first.',
    toastUploadImgFirst: 'Upload images first.',
    toastRangeKb:        'Enter 20–10240 KB.',
    toastDownloading:    'Downloading ',
    toastDownloadFail:   'Download failed: ',
    toastNoReady:        'No ready documents.',
    toastStarted:        'Started ',
    toastDownloads:      ' downloads.',
    toastDownloadError:  'Download error: ',
    toastSentTo:         'Sent to ',
    toastNewDocCreated:  'Created new document card.',
    toastSelectImgSdt:   'Select an image or PDF.',
    toastPdfConvertFirst: 'Converting PDF first...',
    toastPdfConvertError: 'Could not convert PDF.',
    toastCropApplied:    'Crop applied!',
    toastReset:          'Reset!',
    toastDownloaded:     'Downloaded!',
    toastSelectImgWm:    'Select an image.',
    toastPdfLibNotLoaded: 'PDF library not loaded',
    toastQualitySet:     'Quality set to ',
    toastOccupied:       ' is occupied.',
    toastGenerateFirst:  'Generate output first.',
    toastReadyCount:     ' ready',

    /* ---- Photo Maker tab ---- */
    tabPhotoMaker:       '📸 Photo Maker',
    pmCardTitle:         '📸 Photo Maker',
    pmCardSub:           'Upload a photo, crop it, remove the background, then place it on a sheet. Add more persons as needed.',
    pmLabelPersons:      '👤 Number of Persons',
    pmLabelOrientation:  '📄 Page Orientation',
    pmOrientPortrait:    'Portrait',
    pmOrientLandscape:   'Landscape',
    pmLabelGap:          '↔ Gap (mm)',
    pmLabelMargin:       '📐 Margin (mm)',
    pmLabelPaperSize:    '🖨 Paper Size',
    pmLabelStartFrom:    '📌 Start Placing From',
    pmLabelFillPhotos:   '🔀 Fill Photos',
    pmDirRow:            'Row by Row (→ then ↓)',
    pmDirCol:            'Column by Column (↓ then →)',
    pmFillPageTitle:     '🗂 Fill Page with Uploaded Photos',
    pmFillPageSub:       'Fills the whole page using the count you entered per person above. Photos are placed in an equal grid with larger margins & gaps, covering the full page area.',
    pmExtraMarginLabel:  'Add 1.5 inch signature margin on:',
    pmSideBottom:        'Bottom',
    pmSideTop:           'Top',
    pmSideLeft:          'Left',
    pmSideRight:         'Right',
    pmBtnFillPage:       '📄 Download Fill-Page PDF',
    pmBtnPrint:          '🖨 Print',
    pmBtnPreview:        '🔄 Preview',
    pmPreviewTitle:      '🖼 Combined A4 Preview',
    pmBtnDownloadPdf:    '⬇ Download A4 PDF',
    pmBtnRefresh:        '🔄 Refresh Preview',
    pmSaveEdited:        'Save edited photo:',

    /* ---- Bulk PDF Builder & PDF Compressor tab ---- */
    tabBulkPdf:          '📚 Bulk PDF Builder',
    pcCardTitle:         '🗜 PDF Compressor',
    pcCardSub:           'Upload any PDF and reduce its file size using the slider below. All content is preserved — only quality is adjusted.',
    pcDropLabel:         'Click or drag a PDF here',
    pcDropHint:          'Any PDF · up to 200 pages · 100% local processing',
    pcQualLabel:         '🎚 Quality / Size',
    pcQualHint:          '(lower = smaller file)',
    pcLabelSmallest:     'Smallest',
    pcLabelHighest:      'Highest',
    pcTargetSizeLabel:   'Or target size:',
    pcBtnSet:            'Set',
    pcStatOrigSize:      'Original Size',
    pcStatPages:         'Pages',
    pcStatEstOut:        'Est. Output',
    pcBtnDownload:       '⬇ Download Compressed PDF',
    pcBtnClear:          'Clear',
    bpCardTitle:         '📚 Bulk PDF Builder',
    bpCardSub:           'Upload 40–50 images or PDFs at once, arrange them in any order, preview each page, then download as one combined PDF.',
    bpDropLabel:         'Click or drag JPG / PNG / PDF files here',
    bpDropHint:          'Multiple files at once · up to 100 files · all processing is local',
    bpBtnAddMore:        '+ Add More',
    bpBtnSortName:       '🔤 Sort by Name',
    bpBtnReverse:        '↕ Reverse',
    bpBtnClearAll:       '🗑 Clear All',
    bpBtnDownloadPdf:    '⬇ Download PDF',
    bpReorderHint:       'Drag thumbnails to reorder · click a thumbnail to preview · click ✕ to remove',
  },

  hi: {
    /* ---- Brand / Header ---- */
    brandName:       'डॉक्यूमेंट स्टिचर 7.0',
    brandTagline:    'A4 PDF निर्माता · PDF/JPG/PNG आउटपुट · कोई अपलोड नहीं · 100% स्थानीय',
    helpBtn:         'सहायता',

    /* ---- Help panel ---- */
    helpTitle:  'उपयोग कैसे करें',
    helpStep1:  'नीचे दिए बटनों से दो-तरफा या एक-तरफा दस्तावेज़ कार्ड जोड़ें।',
    helpStep2:  'सामने की (और दो-तरफा के लिए पीछे की) छवि अपलोड करें। PDF स्वचालित रूप से छवि में बदल जाएगी।',
    helpStep3:  'हस्ताक्षर छवि जोड़ने के लिए चेकबॉक्स चालू करें। सटीक स्थान के लिए 🎯 हस्ताक्षर रखें बटन दबाएं (बड़े कदमों के लिए Shift दबाएं)।',
    helpStep4:  'डाउनलोड पर क्लिक करें और PDF, JPG या PNG फॉर्मेट चुनें।',
    helpStep5:  'नीचे दाईं ओर Single-Doc Tools से किसी भी छवि या PDF को एक साथ क्रॉप, घुमाएं, पलटें, संपीड़ित और परिवर्तित करें।',

    /* ---- Batch toolbar ---- */
    sectionDocuments: 'दस्तावेज़',
    toolbarSub:       ' तैयार · A4 · PDF / JPG / PNG आउटपुट',
    btnTwoSided:      '+ दो-तरफा',
    btnOneSided:      '+ एक-तरफा',
    btnDownloadAll:   'सभी डाउनलोड करें',

    /* ---- Document card ---- */
    typeLabelTwoSided: 'A4 PDF',
    typeLabelOneSided: 'एक-तरफा PDF',
    docNameAria:       'दस्तावेज़ का नाम',
    removeTitle:       'हटाएं',
    labelOrientation:  'अभिमुखीकरण',
    optPortrait:       'पोर्ट्रेट',
    optLandscape:      'लैंडस्केप',
    labelQuality:      'गुणवत्ता',
    targetSizePlaceholder: 'लक्ष्य KB',
    btnSet:            'सेट करें',
    labelDownloadSize: 'डाउनलोड आकार',
    previewClickHint:  'बड़ा करने के लिए क्लिक करें',
    previewAltReady:   'प्रीव्यू के लिए क्लिक करें',
    previewAltWait:    'प्रीव्यू के लिए छवि अपलोड करें',
    sigToggle:         'हस्ताक्षर छवि जोड़ें (कीबोर्ड से स्थान चुनें)',
    btnDownload:       'डाउनलोड',
    btnPreview:        'प्रीव्यू',
    btnClearImages:    'छवि हटाएं',
    btnPlaceSign:      '🎯 हस्ताक्षर रखें',

    /* ---- Signature controls ---- */
    labelSigSize: 'हस्ताक्षर का आकार',
    signPresetSmall:  'छोटा',
    signPresetNormal: 'सामान्य',
    signPresetLarge:  'बड़ा',
    signPresetXL:     'अति बड़ा',
    signOffsetLabel:  'स्थान:',
    btnResetOffset:   'रीसेट',

    /* ---- Slot labels ---- */
    slotFront:        'सामने की तरफ',
    slotBack:         'पीछे की तरफ',
    slotSign:         'हस्ताक्षर',
    slotBadgeFront:   'सामने',
    slotBadgeBack:    'पीछे',
    dropClickOrDrag:  'यहाँ क्लिक या खींचें',
    dropOptional:     'वैकल्पिक हस्ताक्षर',
    hintImagePdf:     'JPG, PNG, WebP या PDF',
    hintImageOnly:    'JPG, PNG, WebP',
    btnRemoveSlot:    'हटाएं',
    btnViewSlot:      'देखें',
    noSignature:      'कोई हस्ताक्षर नहीं',
    slotRequired:     'आवश्यक',

    /* ---- Estimate texts ---- */
    estimateCalculating: 'गणना हो रही है...',
    estimatePending:     'प्रतीक्षारत',
    estimateAddFront:    'सामने की छवि जोड़ें',
    estimateAddBoth:     'सामने और पीछे की छवि जोड़ें',

    /* ---- Download picker modal ---- */
    dlPickerTitle:  'डाउनलोड फॉर्मेट चुनें',
    dlPickerAllTitle: 'सभी डाउनलोड के लिए फॉर्मेट चुनें',
    dlFmtPdfSub:    'A4 प्रिंट-रेडी',
    dlFmtJpgSub:    'छोटा फाइल आकार',
    dlFmtPngSub:    'बिना नुकसान गुणवत्ता',
    btnCancel:      'रद्द करें',

    /* ---- Signature placer modal ---- */
    sigPlacerTitle: '🎯 तीर कुंजियों से हस्ताक्षर रखें',
    sigPlacerHint:  '← → ↑ ↓ से हिलाएं · Shift + तीर = बड़े कदम · Enter से पुष्टि · Esc से रद्द',
    sigPlacerPos:   'स्थान:',
    btnConfirmPlacement: '✓ स्थान पुष्टि करें',

    /* ---- SDT page ---- */
    btnBackToStitcher: 'स्टिचर पर वापस जाएं',
    sdtBadge:          'एकल-डॉक टूल्स',
    sdtPageTitle:      'एकल-पक्ष टूल्स',
    sdtPageSub:        'छवि या PDF संपादित करें: क्रॉप, घुमाएं, पलटें, संपीड़ित, परिवर्तित — सब एक साथ। 100% स्थानीय।',
    tabMultiTool:      '✨ मल्टी-टूल एडिटर',
    tabWatermark:      'वॉटरमार्क',
    mtCardTitle:       'मल्टी-टूल छवि / PDF एडिटर',
    mtCardSub:         'एक छवि या PDF अपलोड करें और क्रॉप, घुमाना, पलटना, संपीड़न और परिवर्तन — सब एक साथ लागू करें।',
    mtDropLabel:       'छवि / PDF यहाँ क्लिक या खींचें',
    mtDropHint:        'JPG, PNG, WebP, PDF समर्थित',
    labelRotateFlip:   'घुमाएं और पलटें',
    btnRotateL:        '↺ 90° बाएं',
    btnRotateR:        '↻ 90° दाएं',
    btnRotate180:      '↕ 180°',
    btnFlipH:          '⇆ क्षैतिज पलटें',
    btnFlipV:          '⇅ ऊर्ध्वाधर पलटें',
    labelCrop:         'क्रॉप — नीचे की छवि पर खींचकर क्षेत्र चुनें',
    btnApplyCrop:      '✂ क्रॉप लागू करें',
    btnClearCrop:      'क्रॉप हटाएं',
    labelCompressConvert: 'संपीड़न और परिवर्तन',
    labelOutputFmt:    'आउटपुट फॉर्मेट',
    labelQualMt:       'गुणवत्ता',
    labelMaxWidth:     'अधिकतम चौड़ाई',
    labelPreviewOut:   'आउटपुट प्रीव्यू',
    btnDownloadMt:     'डाउनलोड',
    btnSendToStitcher: 'स्टिचर को भेजें',
    btnClearMt:        'साफ करें',
    wmCardTitle:       'टेक्स्ट वॉटरमार्क',
    wmDropLabel:       'यहाँ छवि क्लिक या खींचें',
    wmDropHint:        'कस्टम टेक्स्ट वॉटरमार्क जोड़ें',
    labelWmText:       'वॉटरमार्क टेक्स्ट',
    labelWmPos:        'स्थान',
    wmPosCenter:       'केंद्र',
    wmPosTile:         'टाइल्ड',
    wmPosTopLeft:      'ऊपर बाएं',
    wmPosTopRight:     'ऊपर दाएं',
    wmPosBotLeft:      'नीचे बाएं',
    wmPosBotRight:     'नीचे दाएं',
    labelWmSize:       'फ़ॉन्ट आकार',
    labelWmOp:         'अपारदर्शिता',
    labelWmRot:        'घुमाव',
    labelWmColor:      'रंग',
    wmColorPick:       'रंग चुनें',
    labelWmPreview:    'प्रीव्यू',
    btnDownloadWm:     'डाउनलोड',
    btnSendWmToStitcher: 'स्टिचर को भेजें',
    btnClearWm:        'साफ करें',

    /* ---- Slot picker ---- */
    slotPickerTitle:   'दस्तावेज़ कार्ड को भेजें',
    slotPickerAddNew:  'नया दस्तावेज़ जोड़ें',
    slotBtnFront:      'सामने',
    slotBtnBack:       'पीछे',
    slotBtnSign:       'हस्ताक्षर',

    /* ---- Toast messages (JS) ---- */
    toastKeepOne:        'कम से कम एक दस्तावेज़ कार्ड रखें।',
    toastKeepTwo:        'कम से कम दो दस्तावेज़ कार्ड रखें।',
    toastSignSaved:      'हस्ताक्षर का स्थान सहेजा गया!',
    toastSignOnlyImg:    'हस्ताक्षर छवि होनी चाहिए (JPG/PNG/WebP)।',
    toastSelectImg:      'कृपया JPG, PNG, WebP या PDF चुनें।',
    toastPdfConverting:  'PDF पृष्ठ को छवि में बदला जा रहा है...',
    toastPdfConverted:   'PDF पृष्ठ परिवर्तित!',
    toastPdfError:       'PDF नहीं पढ़ी जा सकी। JPG/PNG आज़माएं।',
    toastImageError:     'छवि नहीं पढ़ी जा सकी।',
    toastUploadFirst:    'पहले आवश्यक छवियां अपलोड करें।',
    toastUploadImgFirst: 'पहले छवि अपलोड करें।',
    toastRangeKb:        '20–10240 KB दर्ज करें।',
    toastDownloading:    'डाउनलोड हो रहा है ',
    toastDownloadFail:   'डाउनलोड विफल: ',
    toastNoReady:        'कोई तैयार दस्तावेज़ नहीं।',
    toastStarted:        'शुरू हुआ ',
    toastDownloads:      ' डाउनलोड।',
    toastDownloadError:  'डाउनलोड त्रुटि: ',
    toastSentTo:         'भेजा गया ',
    toastNewDocCreated:  'नया दस्तावेज़ कार्ड बनाया गया।',
    toastSelectImgSdt:   'एक छवि या PDF चुनें।',
    toastPdfConvertFirst: 'पहले PDF बदल रहे हैं...',
    toastPdfConvertError: 'PDF परिवर्तित नहीं हो सकी।',
    toastCropApplied:    'क्रॉप लागू हो गई!',
    toastReset:          'रीसेट!',
    toastDownloaded:     'डाउनलोड हो गया!',
    toastSelectImgWm:    'एक छवि चुनें।',
    toastPdfLibNotLoaded: 'PDF लाइब्रेरी लोड नहीं हुई',
    toastQualitySet:     'गुणवत्ता सेट की गई ',
    toastOccupied:       ' पहले से भरा हुआ है।',
    toastGenerateFirst:  'पहले आउटपुट बनाएं।',
    toastReadyCount:     ' तैयार',

    /* ---- Photo Maker tab ---- */
    tabPhotoMaker:       '📸 फ़ोटो मेकर',
    pmCardTitle:         '📸 फ़ोटो मेकर',
    pmCardSub:           'फ़ोटो अपलोड करें, क्रॉप करें, बैकग्राउंड हटाएं, फिर शीट पर रखें। जरूरत के अनुसार और व्यक्ति जोड़ें।',
    pmLabelPersons:      '👤 व्यक्तियों की संख्या',
    pmLabelOrientation:  '📄 पृष्ठ अभिमुखीकरण',
    pmOrientPortrait:    'पोर्ट्रेट',
    pmOrientLandscape:   'लैंडस्केप',
    pmLabelGap:          '↔ अंतराल (mm)',
    pmLabelMargin:       '📐 मार्जिन (mm)',
    pmLabelPaperSize:    '🖨 कागज़ का आकार',
    pmLabelStartFrom:    '📌 यहाँ से शुरू करें',
    pmLabelFillPhotos:   '🔀 फ़ोटो भरें',
    pmDirRow:            'पंक्ति दर पंक्ति (→ फिर ↓)',
    pmDirCol:            'स्तंभ दर स्तंभ (↓ फिर →)',
    pmFillPageTitle:     '🗂 अपलोड की गई फ़ोटो से पृष्ठ भरें',
    pmFillPageSub:       'ऊपर दर्ज की गई संख्या का उपयोग करके पूरे पृष्ठ को भरता है। फ़ोटो एक समान ग्रिड में रखी जाती हैं।',
    pmExtraMarginLabel:  '1.5 इंच हस्ताक्षर मार्जिन जोड़ें:',
    pmSideBottom:        'नीचे',
    pmSideTop:           'ऊपर',
    pmSideLeft:          'बाईं',
    pmSideRight:         'दाईं',
    pmBtnFillPage:       '📄 फुल-पेज PDF डाउनलोड',
    pmBtnPrint:          '🖨 प्रिंट',
    pmBtnPreview:        '🔄 प्रीव्यू',
    pmPreviewTitle:      '🖼 संयुक्त A4 प्रीव्यू',
    pmBtnDownloadPdf:    '⬇ A4 PDF डाउनलोड',
    pmBtnRefresh:        '🔄 प्रीव्यू ताज़ा करें',
    pmSaveEdited:        'संपादित फ़ोटो सहेजें:',

    /* ---- Bulk PDF Builder & PDF Compressor tab ---- */
    tabBulkPdf:          '📚 बल्क PDF बिल्डर',
    pcCardTitle:         '🗜 PDF कम्प्रेसर',
    pcCardSub:           'कोई भी PDF अपलोड करें और नीचे स्लाइडर से फ़ाइल आकार कम करें। सभी सामग्री सुरक्षित रहती है।',
    pcDropLabel:         'PDF यहाँ क्लिक या खींचें',
    pcDropHint:          'कोई भी PDF · 200 पृष्ठ तक · 100% स्थानीय प्रसंस्करण',
    pcQualLabel:         '🎚 गुणवत्ता / आकार',
    pcQualHint:          '(कम = छोटी फ़ाइल)',
    pcLabelSmallest:     'सबसे छोटा',
    pcLabelHighest:      'सर्वोच्च',
    pcTargetSizeLabel:   'या लक्ष्य आकार:',
    pcBtnSet:            'सेट',
    pcStatOrigSize:      'मूल आकार',
    pcStatPages:         'पृष्ठ',
    pcStatEstOut:        'अनुमानित आउटपुट',
    pcBtnDownload:       '⬇ संपीड़ित PDF डाउनलोड',
    pcBtnClear:          'साफ करें',
    bpCardTitle:         '📚 बल्क PDF बिल्डर',
    bpCardSub:           'एक साथ 40–50 छवियां या PDFs अपलोड करें, क्रम व्यवस्थित करें, प्रत्येक पृष्ठ देखें, फिर एक PDF डाउनलोड करें।',
    bpDropLabel:         'JPG / PNG / PDF फ़ाइलें यहाँ क्लिक या खींचें',
    bpDropHint:          'एक साथ कई फ़ाइलें · 100 तक · सभी प्रसंस्करण स्थानीय',
    bpBtnAddMore:        '+ और जोड़ें',
    bpBtnSortName:       '🔤 नाम से क्रमबद्ध करें',
    bpBtnReverse:        '↕ उल्टा करें',
    bpBtnClearAll:       '🗑 सब साफ करें',
    bpBtnDownloadPdf:    '⬇ PDF डाउनलोड',
    bpReorderHint:       'क्रम बदलने के लिए खींचें · प्रीव्यू के लिए क्लिक करें · हटाने के लिए ✕ दबाएं',
  },

  bn: {
    /* ---- Brand / Header ---- */
    brandName:       'ডকুমেন্ট স্টিচার ৭.০',
    brandTagline:    'A4 PDF নির্মাতা · PDF/JPG/PNG আউটপুট · কোনো আপলোড নেই · ১০০% স্থানীয়',
    helpBtn:         'সহায়তা',

    /* ---- Help panel ---- */
    helpTitle:  'কীভাবে ব্যবহার করবেন',
    helpStep1:  'নিচের বোতাম দিয়ে দ্বি-পার্শ্বীয় বা এক-পার্শ্বীয় ডকুমেন্ট কার্ড যোগ করুন।',
    helpStep2:  'সামনের ছবি (এবং দ্বি-পার্শ্বীয়ের জন্য পিছনের ছবি) আপলোড করুন। PDF স্বয়ংক্রিয়ভাবে ছবিতে রূপান্তরিত হবে।',
    helpStep3:  'স্বাক্ষর ছবি যোগ করতে চেকবক্সটি চালু করুন। সঠিক অবস্থানের জন্য 🎯 স্বাক্ষর স্থাপন বোতাম ব্যবহার করুন।',
    helpStep4:  'ডাউনলোড বোতামে ক্লিক করুন এবং PDF, JPG, বা PNG ফরম্যাট বেছে নিন।',
    helpStep5:  'Single-Doc Tools (নিচে ডানে) দিয়ে যেকোনো ছবি বা PDF ক্রপ, ঘোরান, উল্টান, সংকোচন ও রূপান্তর করুন।',

    /* ---- Batch toolbar ---- */
    sectionDocuments: 'ডকুমেন্টসমূহ',
    toolbarSub:       ' প্রস্তুত · A4 · PDF / JPG / PNG আউটপুট',
    btnTwoSided:      '+ দ্বি-পার্শ্বীয়',
    btnOneSided:      '+ এক-পার্শ্বীয়',
    btnDownloadAll:   'সব ডাউনলোড',

    /* ---- Document card ---- */
    typeLabelTwoSided: 'A4 PDF',
    typeLabelOneSided: 'এক-পার্শ্বীয় PDF',
    docNameAria:       'ডকুমেন্টের নাম',
    removeTitle:       'সরান',
    labelOrientation:  'অভিমুখ',
    optPortrait:       'পোর্ট্রেট',
    optLandscape:      'ল্যান্ডস্কেপ',
    labelQuality:      'মান',
    targetSizePlaceholder: 'লক্ষ্য KB',
    btnSet:            'সেট',
    labelDownloadSize: 'ডাউনলোড আকার',
    previewClickHint:  'বড় করতে ক্লিক করুন',
    previewAltReady:   'প্রিভিউ দেখতে ক্লিক করুন',
    previewAltWait:    'প্রিভিউর জন্য ছবি আপলোড করুন',
    sigToggle:         'স্বাক্ষর ছবি যোগ করুন (কীবোর্ড দিয়ে স্থান নির্ধারণ)',
    btnDownload:       'ডাউনলোড',
    btnPreview:        'প্রিভিউ',
    btnClearImages:    'ছবি মুছুন',
    btnPlaceSign:      '🎯 স্বাক্ষর স্থাপন',

    /* ---- Signature controls ---- */
    labelSigSize: 'স্বাক্ষরের আকার',
    signPresetSmall:  'ছোট',
    signPresetNormal: 'স্বাভাবিক',
    signPresetLarge:  'বড়',
    signPresetXL:     'অতি বড়',
    signOffsetLabel:  'অবস্থান:',
    btnResetOffset:   'পুনরায় সেট',

    /* ---- Slot labels ---- */
    slotFront:        'সামনের দিক',
    slotBack:         'পেছনের দিক',
    slotSign:         'স্বাক্ষর',
    slotBadgeFront:   'সামনে',
    slotBadgeBack:    'পেছনে',
    dropClickOrDrag:  'এখানে ক্লিক বা টেনে আনুন',
    dropOptional:     'ঐচ্ছিক স্বাক্ষর',
    hintImagePdf:     'JPG, PNG, WebP বা PDF',
    hintImageOnly:    'JPG, PNG, WebP',
    btnRemoveSlot:    'সরান',
    btnViewSlot:      'দেখুন',
    noSignature:      'কোনো স্বাক্ষর নেই',
    slotRequired:     'আবশ্যক',

    /* ---- Estimate texts ---- */
    estimateCalculating: 'গণনা হচ্ছে...',
    estimatePending:     'অপেক্ষারত',
    estimateAddFront:    'সামনের ছবি যোগ করুন',
    estimateAddBoth:     'সামনে ও পেছনের ছবি যোগ করুন',

    /* ---- Download picker modal ---- */
    dlPickerTitle:    'ডাউনলোড ফরম্যাট বেছে নিন',
    dlPickerAllTitle: 'সব ডাউনলোডের ফরম্যাট বেছে নিন',
    dlFmtPdfSub:      'A4 প্রিন্ট-রেডি',
    dlFmtJpgSub:      'ছোট ফাইল সাইজ',
    dlFmtPngSub:      'ক্ষতিহীন মান',
    btnCancel:        'বাতিল',

    /* ---- Signature placer modal ---- */
    sigPlacerTitle: '🎯 তীর কী দিয়ে স্বাক্ষর স্থাপন করুন',
    sigPlacerHint:  '← → ↑ ↓ সরাতে · Shift + তীর = বড় পদক্ষেপ · Enter নিশ্চিত করতে · Esc বাতিল করতে',
    sigPlacerPos:   'অবস্থান:',
    btnConfirmPlacement: '✓ স্থান নিশ্চিত করুন',

    /* ---- SDT page ---- */
    btnBackToStitcher: 'স্টিচারে ফিরুন',
    sdtBadge:          'একক-ডক টুলস',
    sdtPageTitle:      'একক-দিক টুলস',
    sdtPageSub:        'ছবি বা PDF সম্পাদনা করুন: ক্রপ, ঘোরান, উল্টান, সংকোচন, রূপান্তর — সব একসাথে। ১০০% স্থানীয়।',
    tabMultiTool:      '✨ মাল্টি-টুল এডিটর',
    tabWatermark:      'ওয়াটারমার্ক',
    mtCardTitle:       'মাল্টি-টুল ছবি / PDF এডিটর',
    mtCardSub:         'একটি ছবি বা PDF আপলোড করুন এবং ক্রপ, ঘোরানো, উল্টানো, সংকোচন ও রূপান্তর — সব একসাথে প্রয়োগ করুন।',
    mtDropLabel:       'ছবি / PDF এখানে ক্লিক বা টেনে আনুন',
    mtDropHint:        'JPG, PNG, WebP, PDF সমর্থিত',
    labelRotateFlip:   'ঘোরান ও উল্টান',
    btnRotateL:        '↺ ৯০° বামে',
    btnRotateR:        '↻ ৯০° ডানে',
    btnRotate180:      '↕ ১৮০°',
    btnFlipH:          '⇆ অনুভূমিক উল্টান',
    btnFlipV:          '⇅ উল্লম্ব উল্টান',
    labelCrop:         'ক্রপ — নিচের ছবিতে টেনে এলাকা নির্বাচন করুন',
    btnApplyCrop:      '✂ ক্রপ প্রয়োগ',
    btnClearCrop:      'ক্রপ মুছুন',
    labelCompressConvert: 'সংকোচন ও রূপান্তর',
    labelOutputFmt:    'আউটপুট ফরম্যাট',
    labelQualMt:       'মান',
    labelMaxWidth:     'সর্বোচ্চ প্রস্থ',
    labelPreviewOut:   'আউটপুট প্রিভিউ',
    btnDownloadMt:     'ডাউনলোড',
    btnSendToStitcher: 'স্টিচারে পাঠান',
    btnClearMt:        'মুছুন',
    wmCardTitle:       'টেক্সট ওয়াটারমার্ক',
    wmDropLabel:       'এখানে ছবি ক্লিক বা টেনে আনুন',
    wmDropHint:        'কাস্টম টেক্সট ওয়াটারমার্ক যোগ করুন',
    labelWmText:       'ওয়াটারমার্ক টেক্সট',
    labelWmPos:        'অবস্থান',
    wmPosCenter:       'কেন্দ্র',
    wmPosTile:         'টাইলড',
    wmPosTopLeft:      'উপরে বামে',
    wmPosTopRight:     'উপরে ডানে',
    wmPosBotLeft:      'নিচে বামে',
    wmPosBotRight:     'নিচে ডানে',
    labelWmSize:       'ফন্ট সাইজ',
    labelWmOp:         'অস্বচ্ছতা',
    labelWmRot:        'ঘূর্ণন',
    labelWmColor:      'রঙ',
    wmColorPick:       'রঙ বাছুন',
    labelWmPreview:    'প্রিভিউ',
    btnDownloadWm:     'ডাউনলোড',
    btnSendWmToStitcher: 'স্টিচারে পাঠান',
    btnClearWm:        'মুছুন',

    /* ---- Slot picker ---- */
    slotPickerTitle:   'ডকুমেন্ট কার্ডে পাঠান',
    slotPickerAddNew:  'নতুন ডকুমেন্ট যোগ করুন',
    slotBtnFront:      'সামনে',
    slotBtnBack:       'পেছনে',
    slotBtnSign:       'স্বাক্ষর',

    /* ---- Toast messages (JS) ---- */
    toastKeepOne:        'অন্তত একটি ডকুমেন্ট কার্ড রাখুন।',
    toastKeepTwo:        'অন্তত দুটি ডকুমেন্ট কার্ড রাখুন।',
    toastSignSaved:      'স্বাক্ষরের অবস্থান সংরক্ষিত!',
    toastSignOnlyImg:    'স্বাক্ষর অবশ্যই ছবি হতে হবে (JPG/PNG/WebP)।',
    toastSelectImg:      'অনুগ্রহ করে JPG, PNG, WebP বা PDF নির্বাচন করুন।',
    toastPdfConverting:  'PDF পৃষ্ঠা ছবিতে রূপান্তর করা হচ্ছে...',
    toastPdfConverted:   'PDF পৃষ্ঠা রূপান্তরিত!',
    toastPdfError:       'PDF পড়া যায়নি। JPG/PNG চেষ্টা করুন।',
    toastImageError:     'ছবি পড়া যায়নি।',
    toastUploadFirst:    'আগে প্রয়োজনীয় ছবি আপলোড করুন।',
    toastUploadImgFirst: 'আগে ছবি আপলোড করুন।',
    toastRangeKb:        '২০–১০২৪০ KB লিখুন।',
    toastDownloading:    'ডাউনলোড হচ্ছে ',
    toastDownloadFail:   'ডাউনলোড ব্যর্থ: ',
    toastNoReady:        'কোনো প্রস্তুত ডকুমেন্ট নেই।',
    toastStarted:        'শুরু হয়েছে ',
    toastDownloads:      'টি ডাউনলোড।',
    toastDownloadError:  'ডাউনলোড ত্রুটি: ',
    toastSentTo:         'পাঠানো হয়েছে ',
    toastNewDocCreated:  'নতুন ডকুমেন্ট কার্ড তৈরি হয়েছে।',
    toastSelectImgSdt:   'একটি ছবি বা PDF নির্বাচন করুন।',
    toastPdfConvertFirst: 'PDF রূপান্তর হচ্ছে...',
    toastPdfConvertError: 'PDF রূপান্তর করা যায়নি।',
    toastCropApplied:    'ক্রপ প্রয়োগ হয়েছে!',
    toastReset:          'পুনরায় সেট!',
    toastDownloaded:     'ডাউনলোড হয়েছে!',
    toastSelectImgWm:    'একটি ছবি নির্বাচন করুন।',
    toastPdfLibNotLoaded: 'PDF লাইব্রেরি লোড হয়নি',
    toastQualitySet:     'মান নির্ধারিত হয়েছে ',
    toastOccupied:       ' ইতিমধ্যে পূর্ণ।',
    toastGenerateFirst:  'আগে আউটপুট তৈরি করুন।',
    toastReadyCount:     ' প্রস্তুত',

    /* ---- Photo Maker tab ---- */
    tabPhotoMaker:       '📸 ফটো মেকার',
    pmCardTitle:         '📸 ফটো মেকার',
    pmCardSub:           'ফটো আপলোড করুন, ক্রপ করুন, ব্যাকগ্রাউন্ড সরান, তারপর শিটে রাখুন। প্রয়োজনে আরও ব্যক্তি যোগ করুন।',
    pmLabelPersons:      '👤 ব্যক্তির সংখ্যা',
    pmLabelOrientation:  '📄 পৃষ্ঠার অভিমুখ',
    pmOrientPortrait:    'পোর্ট্রেট',
    pmOrientLandscape:   'ল্যান্ডস্কেপ',
    pmLabelGap:          '↔ ফাঁক (mm)',
    pmLabelMargin:       '📐 মার্জিন (mm)',
    pmLabelPaperSize:    '🖨 কাগজের আকার',
    pmLabelStartFrom:    '📌 এখান থেকে শুরু',
    pmLabelFillPhotos:   '🔀 ফটো পূরণ',
    pmDirRow:            'সারি সারি (→ তারপর ↓)',
    pmDirCol:            'কলাম কলাম (↓ তারপর →)',
    pmFillPageTitle:     '🗂 আপলোড করা ফটো দিয়ে পৃষ্ঠা পূরণ',
    pmFillPageSub:       'উপরে দেওয়া সংখ্যা ব্যবহার করে পুরো পৃষ্ঠা পূরণ করে। ছবিগুলো সমান গ্রিডে রাখা হয়।',
    pmExtraMarginLabel:  '১.৫ ইঞ্চি স্বাক্ষর মার্জিন যোগ করুন:',
    pmSideBottom:        'নিচে',
    pmSideTop:           'উপরে',
    pmSideLeft:          'বামে',
    pmSideRight:         'ডানে',
    pmBtnFillPage:       '📄 ফুল-পেজ PDF ডাউনলোড',
    pmBtnPrint:          '🖨 প্রিন্ট',
    pmBtnPreview:        '🔄 প্রিভিউ',
    pmPreviewTitle:      '🖼 সম্মিলিত A4 প্রিভিউ',
    pmBtnDownloadPdf:    '⬇ A4 PDF ডাউনলোড',
    pmBtnRefresh:        '🔄 প্রিভিউ রিফ্রেশ',
    pmSaveEdited:        'সম্পাদিত ফটো সংরক্ষণ:',

    /* ---- Bulk PDF Builder & PDF Compressor tab ---- */
    tabBulkPdf:          '📚 বাল্ক PDF বিল্ডার',
    pcCardTitle:         '🗜 PDF কম্প্রেসর',
    pcCardSub:           'যেকোনো PDF আপলোড করুন এবং স্লাইডার দিয়ে ফাইলের আকার কমান। সমস্ত বিষয়বস্তু সংরক্ষিত থাকে।',
    pcDropLabel:         'PDF এখানে ক্লিক বা টেনে আনুন',
    pcDropHint:          'যেকোনো PDF · ২০০ পৃষ্ঠা পর্যন্ত · ১০০% স্থানীয় প্রক্রিয়াকরণ',
    pcQualLabel:         '🎚 মান / আকার',
    pcQualHint:          '(কম = ছোট ফাইল)',
    pcLabelSmallest:     'সবচেয়ে ছোট',
    pcLabelHighest:      'সর্বোচ্চ',
    pcTargetSizeLabel:   'বা লক্ষ্য আকার:',
    pcBtnSet:            'সেট',
    pcStatOrigSize:      'মূল আকার',
    pcStatPages:         'পৃষ্ঠা',
    pcStatEstOut:        'আনুমানিক আউটপুট',
    pcBtnDownload:       '⬇ সংকুচিত PDF ডাউনলোড',
    pcBtnClear:          'মুছুন',
    bpCardTitle:         '📚 বাল্ক PDF বিল্ডার',
    bpCardSub:           'একসাথে ৪০–৫০টি ছবি বা PDF আপলোড করুন, ক্রম সাজান, প্রতিটি পৃষ্ঠা দেখুন, তারপর একটি PDF ডাউনলোড করুন।',
    bpDropLabel:         'JPG / PNG / PDF ফাইল এখানে ক্লিক বা টেনে আনুন',
    bpDropHint:          'একসাথে একাধিক ফাইল · ১০০ পর্যন্ত · সব প্রক্রিয়াকরণ স্থানীয়',
    bpBtnAddMore:        '+ আরও যোগ করুন',
    bpBtnSortName:       '🔤 নাম অনুযায়ী সাজান',
    bpBtnReverse:        '↕ উল্টো করুন',
    bpBtnClearAll:       '🗑 সব মুছুন',
    bpBtnDownloadPdf:    '⬇ PDF ডাউনলোড',
    bpReorderHint:       'ক্রম পরিবর্তনে টেনে আনুন · প্রিভিউতে ক্লিক করুন · সরাতে ✕ চাপুন',
  },
};

/* ============================================================
   Language switcher — 3-language with picker modal
============================================================ */
const Lang = (() => {
  const SUPPORTED = ['en', 'hi', 'bn'];
  let _current = localStorage.getItem('ds-lang') || 'en';
  if (!SUPPORTED.includes(_current)) _current = 'en';

  function t(key) {
    return (I18N[_current] && I18N[_current][key]) || (I18N['en'][key]) || key;
  }

  function applyToDOM() {
    const langMap = { en: 'en', hi: 'hi', bn: 'bn' };
    document.documentElement.lang = langMap[_current] || 'en';

    /* ---------- static elements by data-i18n attribute ---------- */
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const attr = el.getAttribute('data-i18n-attr');
      if (attr) {
        el.setAttribute(attr, t(key));
      } else {
        el.textContent = t(key);
      }
    });

    /* ---------- placeholders ---------- */
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.placeholder = t(el.getAttribute('data-i18n-ph'));
    });

    /* ---------- Landing page text (index.html) ---------- */
    const LP_TEXT = {
      en: {
        heroEyebrow:   '🇮🇳 Made in India · Your Files Never Leave Your Device',
        heroH1:        'Document PDFs &amp;<br>Passport Photos,<br><span class="h1-grad">Done Instantly.</span>',
        heroSub:       'Stitch front &amp; back scans into one clean A4 PDF. Make passport photos. Remove backgrounds. Compress PDFs. Seven tools — all running right inside your browser.',
        heroSubEm:     'Your files never touch a server.',
        heroCta:       'Open App — It\'s Free',
        heroGhost:     'See All Tools ↓',
        heroNote:      'No account needed. · No file uploads. · Works in any browser.',
        navFeatures:   'Features',
        navHow:        'How It Works',
        navPrivacy:    'Privacy',
        navCta:        'Open App — Free',
        secEyeFeat:    'Everything Included',
        secH2Feat:     'All the tools you need,<br>right in your browser.',
        secSubFeat:    'Seven powerful tools — no installs, no sign-up, no credit card. Open the app and start immediately.',
        secEyeHow:     'Simple Process',
        secH2How:      'Ready in four steps.',
        secSubHow:     'No complicated software. No account forms. Open the app and everything works immediately.',
        secEyePriv:    'Privacy First',
        secH2Priv:     'Your documents never leave your device.',
        secEyeWho:     'Who It\'s For',
        secH2Who:      'Perfect for everyday document tasks.',
        ctaH2:         'Start making your documents<br>the smart way.',
        ctaSub:        'All 7 tools. Instant access. Your files stay on your device — always.',
        ctaBtn:        'Open App — It\'s Free',
        step1Title:    'Open the App',
        step1Desc:     'Click "Open App" — no sign-up, no email form, no password required.',
        step2Title:    'Upload Your Files',
        step2Desc:     'Drag and drop your document scans, photos, or PDFs. Everything processes inside your browser.',
        step3Title:    'Edit & Arrange',
        step3Desc:     'Crop, rotate, remove background, place signatures, compress, reorder pages.',
        step4Title:    'Download or Print',
        step4Desc:     'Save as PDF, JPG, or PNG. Or send directly to your printer. Print-ready at 300 DPI.',
      },
      hi: {
        heroEyebrow:   '🇮🇳 भारत में निर्मित · आपकी फ़ाइलें आपके डिवाइस पर रहती हैं',
        heroH1:        'दस्तावेज़ PDF और<br>पासपोर्ट फ़ोटो,<br><span class="h1-grad">तुरंत तैयार।</span>',
        heroSub:       'सामने और पीछे की स्कैन को एक साथ एक A4 PDF में जोड़ें। पासपोर्ट फ़ोटो बनाएं। बैकग्राउंड हटाएं। PDF संपीड़ित करें। सात टूल — सब ब्राउज़र में।',
        heroSubEm:     'आपकी फ़ाइलें कभी सर्वर को नहीं छूतीं।',
        heroCta:       'ऐप खोलें — मुफ़्त',
        heroGhost:     'सभी टूल देखें ↓',
        heroNote:      'कोई अकाउंट नहीं · कोई अपलोड नहीं · किसी भी ब्राउज़र में',
        navFeatures:   'विशेषताएं',
        navHow:        'कैसे काम करता है',
        navPrivacy:    'गोपनीयता',
        navCta:        'ऐप खोलें — मुफ़्त',
        secEyeFeat:    'सब कुछ शामिल है',
        secH2Feat:     'आपके ब्राउज़र में सभी ज़रूरी टूल।',
        secSubFeat:    'सात शक्तिशाली टूल — कोई इंस्टॉल नहीं, कोई साइन-अप नहीं।',
        secEyeHow:     'सरल प्रक्रिया',
        secH2How:      'चार चरणों में तैयार।',
        secSubHow:     'कोई जटिल सॉफ़्टवेयर नहीं। ऐप खोलें और तुरंत शुरू करें।',
        secEyePriv:    'गोपनीयता पहले',
        secH2Priv:     'आपके दस्तावेज़ आपके डिवाइस पर रहते हैं।',
        secEyeWho:     'किसके लिए है',
        secH2Who:      'रोज़ाना के दस्तावेज़ कार्यों के लिए।',
        ctaH2:         'स्मार्ट तरीके से दस्तावेज़ बनाना शुरू करें।',
        ctaSub:        'सभी 7 टूल। तुरंत एक्सेस। फ़ाइलें सदा आपके डिवाइस पर।',
        ctaBtn:        'ऐप खोलें — मुफ़्त',
        step1Title:    'ऐप खोलें',
        step1Desc:     '"ऐप खोलें" क्लिक करें — कोई साइन-अप, ईमेल या पासवर्ड नहीं।',
        step2Title:    'फ़ाइलें अपलोड करें',
        step2Desc:     'दस्तावेज़ स्कैन, फ़ोटो या PDF खींचें और छोड़ें। सब ब्राउज़र में होता है।',
        step3Title:    'संपादित करें',
        step3Desc:     'क्रॉप, घुमाएं, बैकग्राउंड हटाएं, हस्ताक्षर लगाएं, पेज क्रम बदलें।',
        step4Title:    'डाउनलोड या प्रिंट',
        step4Desc:     'PDF, JPG या PNG में सहेजें। 300 DPI प्रिंट-रेडी।',
      },
      bn: {
        heroEyebrow:   '🇮🇳 ভারতে তৈরি · আপনার ফাইল আপনার ডিভাইসে থাকে',
        heroH1:        'ডকুমেন্ট PDF ও<br>পাসপোর্ট ফটো,<br><span class="h1-grad">তাৎক্ষণিকভাবে।</span>',
        heroSub:       'সামনে ও পিছনের স্ক্যান একটি A4 PDF-এ জুড়ুন। পাসপোর্ট ফটো বানান। ব্যাকগ্রাউন্ড সরান। PDF সংকুচিত করুন। সাতটি টুল — সব ব্রাউজারে।',
        heroSubEm:     'আপনার ফাইল কখনো সার্ভারে যায় না।',
        heroCta:       'অ্যাপ খুলুন — বিনামূল্যে',
        heroGhost:     'সব টুল দেখুন ↓',
        heroNote:      'কোনো অ্যাকাউন্ট নেই · কোনো আপলোড নেই · যেকোনো ব্রাউজারে',
        navFeatures:   'বৈশিষ্ট্য',
        navHow:        'কীভাবে কাজ করে',
        navPrivacy:    'গোপনীয়তা',
        navCta:        'অ্যাপ খুলুন — বিনামূল্যে',
        secEyeFeat:    'সব অন্তর্ভুক্ত',
        secH2Feat:     'আপনার ব্রাউজারে সব দরকারি টুল।',
        secSubFeat:    'সাতটি শক্তিশালী টুল — কোনো ইন্সটল নেই, কোনো সাইন-আপ নেই।',
        secEyeHow:     'সহজ প্রক্রিয়া',
        secH2How:      'চারটি ধাপে প্রস্তুত।',
        secSubHow:     'কোনো জটিল সফটওয়্যার নেই। অ্যাপ খুলুন এবং সাথে সাথে শুরু করুন।',
        secEyePriv:    'গোপনীয়তা প্রথমে',
        secH2Priv:     'আপনার ডকুমেন্ট আপনার ডিভাইসে থাকে।',
        secEyeWho:     'কার জন্য',
        secH2Who:      'প্রতিদিনের ডকুমেন্ট কাজের জন্য।',
        ctaH2:         'স্মার্টভাবে ডকুমেন্ট তৈরি শুরু করুন।',
        ctaSub:        'সব ৭টি টুল। তাৎক্ষণিক অ্যাক্সেস। ফাইল সবসময় আপনার ডিভাইসে।',
        ctaBtn:        'অ্যাপ খুলুন — বিনামূল্যে',
        step1Title:    'অ্যাপ খুলুন',
        step1Desc:     '"অ্যাপ খুলুন" ক্লিক করুন — কোনো সাইন-আপ, ইমেইল বা পাসওয়ার্ড নেই।',
        step2Title:    'ফাইল আপলোড করুন',
        step2Desc:     'স্ক্যান, ফটো বা PDF টেনে আনুন। সব ব্রাউজারের ভেতরে হয়।',
        step3Title:    'সম্পাদনা করুন',
        step3Desc:     'ক্রপ, ঘোরান, ব্যাকগ্রাউন্ড সরান, স্বাক্ষর রাখুন, পৃষ্ঠা সাজান।',
        step4Title:    'ডাউনলোড বা প্রিন্ট',
        step4Desc:     'PDF, JPG বা PNG সংরক্ষণ করুন। ৩০০ DPI প্রিন্ট-রেডি।',
      },
    };

    const lp = LP_TEXT[_current] || LP_TEXT.en;

    /* Helper: set innerHTML of element if it exists */
    const setHTML = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    const setAllText = (sel, txt) => { document.querySelectorAll(sel).forEach(el => el.textContent = txt); };

    setHTML('lp-hero-eyebrow-text', lp.heroEyebrow);
    setHTML('lp-hero-h1', lp.heroH1);
    setText('lp-hero-sub', lp.heroSub);
    setText('lp-hero-sub-em', lp.heroSubEm);
    setText('lp-hero-cta', lp.heroCta);
    setText('lp-hero-ghost', lp.heroGhost);
    setText('lp-nav-features', lp.navFeatures);
    setText('lp-nav-how', lp.navHow);
    setText('lp-nav-privacy', lp.navPrivacy);
    setText('lp-nav-cta', lp.navCta);
    setHTML('lp-sec-eye-feat', lp.secEyeFeat);
    setHTML('lp-sec-h2-feat', lp.secH2Feat);
    setText('lp-sec-sub-feat', lp.secSubFeat);
    setText('lp-sec-eye-how', lp.secEyeHow);
    setHTML('lp-sec-h2-how', lp.secH2How);
    setText('lp-sec-sub-how', lp.secSubHow);
    setText('lp-sec-eye-priv', lp.secEyePriv);
    setHTML('lp-sec-h2-priv', lp.secH2Priv);
    setText('lp-sec-eye-who', lp.secEyeWho);
    setHTML('lp-sec-h2-who', lp.secH2Who);
    setHTML('lp-cta-h2', lp.ctaH2);
    setText('lp-cta-sub', lp.ctaSub);
    setText('lp-cta-btn', lp.ctaBtn);
    setText('lp-step1-title', lp.step1Title); setText('lp-step1-desc', lp.step1Desc);
    setText('lp-step2-title', lp.step2Title); setText('lp-step2-desc', lp.step2Desc);
    setText('lp-step3-title', lp.step3Title); setText('lp-step3-desc', lp.step3Desc);
    setText('lp-step4-title', lp.step4Title); setText('lp-step4-desc', lp.step4Desc);

    /* ---------- update active state in lang picker ---------- */
    _updatePickerActiveState();

    /* ---------- re-render dynamic doc cards (uses JS strings) ---------- */
    if (typeof renderDocuments === 'function') renderDocuments();

    /* ---------- re-render slot picker if open ---------- */
    const sp = document.getElementById('slotPicker');
    if (sp && sp.style.display !== 'none' && typeof renderSlotPicker === 'function') {
      renderSlotPicker();
    }

    /* ---------- toolbar ready count ---------- */
    if (typeof updateBatchActions === 'function') updateBatchActions();
  }

  function set(lang) {
    if (!SUPPORTED.includes(lang)) return;
    _current = lang;
    localStorage.setItem('ds-lang', _current);
    closePicker();
    applyToDOM();
  }

  /* Keep toggle() for backward compat — cycles en→hi→bn→en */
  function toggle() {
    const idx = SUPPORTED.indexOf(_current);
    _current = SUPPORTED[(idx + 1) % SUPPORTED.length];
    localStorage.setItem('ds-lang', _current);
    applyToDOM();
  }

  function current() { return _current; }

  /* ---- Picker modal ---- */
  function _ensurePicker() {
    if (document.getElementById('langPickerModal')) return;
    const modal = document.createElement('div');
    modal.id = 'langPickerModal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999990;background:rgba(18,26,40,0.72);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
      <div style="background:#14192a;border-radius:22px;padding:28px 26px;max-width:340px;width:100%;box-shadow:0 32px 72px rgba(0,0,0,0.55),0 8px 24px rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);animation:popIn 0.28s cubic-bezier(.22,.68,0,1.2)">
        <div style="font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:800;color:#f0f4ff;letter-spacing:-0.02em;margin-bottom:6px">🌐 Choose Language</div>
        <div style="font-size:12px;color:#8492a6;margin-bottom:20px">भाषा चुनें &nbsp;·&nbsp; ভাষা বেছে নিন</div>
        <div style="display:flex;flex-direction:column;gap:10px" id="langPickerOptions">
          <button class="lang-opt-btn" id="langOpt_en" onclick="Lang.set('en')">
            <span class="lang-opt-name">English</span>
            <span class="lang-opt-native">English</span>
            <span class="lang-opt-check" id="langCheck_en">✓</span>
          </button>
          <button class="lang-opt-btn" id="langOpt_hi" onclick="Lang.set('hi')">
            <span class="lang-opt-name">Hindi</span>
            <span class="lang-opt-native">हिन्दी</span>
            <span class="lang-opt-check" id="langCheck_hi">✓</span>
          </button>
          <button class="lang-opt-btn" id="langOpt_bn" onclick="Lang.set('bn')">
            <span class="lang-opt-name">Bengali</span>
            <span class="lang-opt-native">বাংলা</span>
            <span class="lang-opt-check" id="langCheck_bn">✓</span>
          </button>
        </div>
        <button onclick="Lang.closePicker()" style="margin-top:18px;width:100%;padding:11px;border-radius:11px;border:1.5px solid rgba(255,255,255,0.15);background:transparent;color:#8492a6;font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:13px;cursor:pointer">Cancel / रद्द / বাতিল</button>
      </div>`;
    /* close on backdrop click */
    modal.addEventListener('click', e => { if (e.target === modal) closePicker(); });
    document.body.appendChild(modal);

    /* inject styles once */
    if (!document.getElementById('langPickerStyles')) {
      const s = document.createElement('style');
      s.id = 'langPickerStyles';
      s.textContent = `
        @keyframes popIn { from{opacity:0;transform:scale(.92)} to{opacity:1;transform:scale(1)} }
        .lang-opt-btn {
          display:flex;align-items:center;gap:12px;
          width:100%;padding:13px 16px;border-radius:13px;
          border:1.5px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);
          cursor:pointer;text-align:left;
          font-family:'Space Grotesk',sans-serif;
          transition:border-color 0.18s,background 0.18s,transform 0.18s;
        }
        .lang-opt-btn:hover { border-color:rgba(245,200,66,0.6);background:rgba(245,200,66,0.08);transform:translateY(-1px); }
        .lang-opt-btn.active { border-color:rgba(245,200,66,0.8);background:rgba(245,200,66,0.12); }
        .lang-opt-name { font-size:14px;font-weight:700;color:#f0f4ff; }
        .lang-opt-native { font-size:13px;color:#8492a6;flex:1; }
        .lang-opt-check { font-size:14px;color:#f5c842;font-weight:800;opacity:0;transition:opacity 0.15s; }
        .lang-opt-btn.active .lang-opt-check { opacity:1; }
      `;
      document.head.appendChild(s);
    }
  }

  function _updatePickerActiveState() {
    SUPPORTED.forEach(lang => {
      const btn = document.getElementById('langOpt_' + lang);
      if (btn) {
        btn.classList.toggle('active', lang === _current);
      }
    });
    /* Update the trigger button label to show current lang */
    const trigger = document.getElementById('langPickerBtn');
    const labels = { en: 'EN', hi: 'हि', bn: 'বাং' };
    if (trigger) trigger.textContent = labels[_current] || 'EN';
  }

  function openPicker() {
    _ensurePicker();
    _updatePickerActiveState();
    const m = document.getElementById('langPickerModal');
    if (m) m.style.display = 'flex';
  }

  function closePicker() {
    const m = document.getElementById('langPickerModal');
    if (m) m.style.display = 'none';
  }

  /* Run on DOM ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyToDOM);
  } else {
    applyToDOM();
  }

  return { t, set, toggle, current, applyToDOM, openPicker, closePicker };
})();

/* Make globally accessible */
window.Lang = Lang;