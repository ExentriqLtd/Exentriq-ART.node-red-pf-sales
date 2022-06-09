const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { Bits } = require('@fry/bits');

const extractImageFromPDF = async (pdfData) => {

  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdfDocument = await loadingTask.promise;
  const pdfPage = await pdfDocument.getPage(1);
  const pdfOperatorList = await pdfPage.getOperatorList();

  const images = [];
  for (let index = 0; index < pdfOperatorList.fnArray.length; index++) {
    if (pdfOperatorList.fnArray[index] === pdfjsLib.OPS.paintImageXObject) {
      images.push(pdfPage.objs.get([pdfOperatorList.argsArray[index][0]]));
    }
  };

  return images.length > 0 ? images[0] : null;

};

const bitmapFileHeader = ({
  filesize = 0,
  applicationHeader = 0,
  imageDataOffset = 0
}) => {
  const buffer = Buffer.alloc(14);
  // A bitmap file starts with a 'BM' in ASCII.
  buffer.write('B', 0);
  buffer.write('M', 1);
  // The entire filesize.
  buffer.writeInt32LE(filesize, 2);
  // 4 bytes reserved for the application creating the image.
  buffer.writeInt32LE(applicationHeader, 6);
  // The byte offset to access the pixel data.
  buffer.writeInt32LE(imageDataOffset, 10);
  return buffer;
};

// Creates a DIB header, specifically a BITMAPINFOHEADER type
// since it's the most widely supported.
const dibHeader = ({
  width,
  height,
  bitsPerPixel,
  bitmapDataSize,
  numberOfColorsInPalette
}) => {
  const buffer = Buffer.alloc(40);
  // The size of the header.
  buffer.writeInt32LE(40, 0);
  // The width and height of the bitmap image.
  buffer.writeInt32LE(width, 4);
  buffer.writeInt32LE(height, 8);
  // The number of color planes, which in bitmap files is always 1
  buffer.writeInt16LE(1, 12);
  buffer.writeInt16LE(bitsPerPixel, 14);

  // Compression method, not supported in this package.
  buffer.writeInt32LE(0, 16);
  buffer.writeInt32LE(bitmapDataSize, 20);
  // The horizontal and vertical resolution of the image.
  // On monitors: 72 DPI × 39.3701 inches per metre yields 2834.6472
  buffer.writeInt32LE(2835, 24);
  buffer.writeInt32LE(2835, 28);
  // Number of colors in the palette.
  buffer.writeInt32LE(numberOfColorsInPalette, 32);
  // Number of important colors used.
  buffer.writeInt32LE(0, 36);
  return buffer;
};

const createBitmapBuffer = ({
  imageData,
  width,
  height,
  bitsPerPixel,
  colorTable = Buffer.alloc(0)
}) => {
  return new Promise((resolve, reject) => {
    const imageDataOffset = 54 + colorTable.length;
    const filesize = imageDataOffset + imageData.length;
    let fileContent = Buffer.alloc(filesize);
    let fileHeader = bitmapFileHeader({
      filesize,
      imageDataOffset
    });
    fileHeader.copy(fileContent);
    dibHeader({
      width,
      height,
      bitsPerPixel,
      bitmapDataSize: imageData.length,
      numberOfColorsInPalette: colorTable.length / 4
    }).copy(fileContent, 14);

    colorTable.copy(fileContent, 54);
    imageData.copy(fileContent, imageDataOffset);
    resolve(fileContent);

  });
}

const getBitmapBuffer = async (pdfImage) => {

  const width = pdfImage.width;
  const height = pdfImage.height;
  const colorTable = Buffer.from([
    0x00, 0x00, 0x00, 0x00,
    0xFF, 0xFF, 0xFF, 0x00
  ]);

  // The image needs to be flipped horizontally and rotated by 180°
  const bits = new Bits(Buffer.from(pdfImage.data));
  const fixedBits = new Bits(bits.length);

  for (let y = 0; y < height; y++) {
    const offset = y * width;
    for (let x = 0; x < width; x++) {
      if (bits.testBit(offset + x)) {
        fixedBits.setBit((height - 1) * width - offset + x);
      }
    }
  }

  const fixedArray = [];
  fixedBits.seek(0);
  while (fixedBits.remaining > 0) {
    fixedArray.push(fixedBits.read(8));
  }

  const buffer = await createBitmapBuffer({
    imageData: Buffer.from(new Uint8ClampedArray(fixedArray)),
    width,
    height,
    bitsPerPixel: 1,
    colorTable
  });

  return buffer;

};

const extractBitmapBuffer = async (pdfData) => {
  try {
    const image = await extractImageFromPDF(pdfData);
    const buffer = await getBitmapBuffer(image);
    return buffer;      
  } catch (error) {
    throw(error);
  }
};


module.exports = {
  extractImageFromPDF,
  extractBitmapBuffer
};