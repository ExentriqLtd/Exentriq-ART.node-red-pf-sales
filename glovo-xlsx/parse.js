// const { Readable } = require('stream');
const { Duplex } = require('stream'); 
const readXlsxFile = require('read-excel-file/node')

const bufferToStream = (buffer) => {
  const stream = new Duplex();
  stream.push(buffer);
  stream.push(null);
  return stream;
};

const matchingProductByEAN = (ean, products) => {
  const product = products.find(x => x.ean === ean);
  return product ? product : null;
};

const matchingProductByCustomerCode = (code, products) => {
  const product = products.find(x => x.customer_code === code);
  return product ? product : null;
};

const parseExcel = async (xlsx, products, warehouse) => {

  const order = {
    destinations: [{
      address: warehouse.address,
      from: warehouse.from,
      to: warehouse.to,
      products: []
    }],
    totals: {
      boxes: 0,
      items: 0
    }
  };

  try {

    const rows = await readXlsxFile(bufferToStream(xlsx));

    if (rows.length > 1) {

      const headers = rows[0].map(x => x.toLowerCase());
      const fieldMap = {
        productEAN: headers.indexOf('Provider Product ID'.toLowerCase()),
        productCode: headers.indexOf('Product ID'.toLowerCase()),
        boxes: headers.findIndex(x => x.startsWith('Quantity in supplier format'.toLowerCase()))
      };

      if ((fieldMap.productEAN > -1 || fieldMap.productCode > -1) && fieldMap.boxes > -1) {

        for (const row of rows.slice(1)) {
          const product = fieldMap.productEAN > -1 ? matchingProductByEAN(row[fieldMap.productEAN].toString(), products) : matchingProductByCustomerCode(row[fieldMap.productCode].toString(), products);
          if (product) {
            const boxes = parseInt(row[fieldMap.boxes]);
            const items = boxes * product.boxItems;
            order.destinations[0].products.push({
              code: product.code,
              ean: product.ean,
              customer_code: product.customer_code,
              description: product.description,
              boxes,
              items
            });
            order.totals.boxes += boxes;
            order.totals.items += items;
          }
        }
      
        return order;
  
      } else {
        throw('Unknown Excel columns disposition');
      }
  
    } else {
      throw('No products found in the order Excel file');
    }

  
  } catch (error) {
    throw(error);
  }

};

module.exports = {
  parseExcel
};


