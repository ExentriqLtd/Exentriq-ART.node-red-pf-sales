// const { Readable } = require('stream');
const { Duplex } = require('stream'); 
const readXlsxFile = require('read-excel-file/node')

const bufferToStream = (buffer) => {
  const stream = new Duplex();
  stream.push(buffer);
  stream.push(null);
  return stream;
};

const matchingProductByCustomerCode = (customerCode, products) => {
  const product = products.find(x => x.customer_code === customerCode);
  return product ? product : null;
};

const parseExcel = async (xlsx, products, warehouses, date) => {

  const order = {
    destinations: [],
    anomalies: [],
    totals: {
      boxes: 0,
      items: 0
    }
  };

  try {
    const rows = await readXlsxFile(bufferToStream(xlsx));

    const headers = rows[0];
  
    const fieldMap = {
      productCode: headers.indexOf('Product Id'),
      boxItems: headers.indexOf('Product Coli Count')
    };

    if (fieldMap.productCode === -1 || fieldMap.boxItems === -1) {
      throw('Unknown Excel columns disposition');
    }
  
    const destinations = [];

    for (let index = fieldMap.boxItems + 1; index < headers.length; index++) {
      if (!headers[index].trim().toLowerCase().startsWith('grand total')) {
        const warehouseIndex = warehouses.map(x => x.name.toLowerCase()).findIndex(x => x.split('|').indexOf(headers[index].trim().toLowerCase()) > -1);
        if (warehouseIndex > -1) {
  
          const destination = {
            name: warehouses[warehouseIndex].name,
            address: warehouses[warehouseIndex].address,
            from: null,
            to: null,
            products: [],
            readBoxTotal: 0
          };
    
          for (const row of rows.slice(1)) {          
            const product = matchingProductByCustomerCode(row[fieldMap.productCode], products);
            if (product) {
    
              const boxes = parseInt(row[index]);
              const items = boxes * product.boxItems;
    
              destination.products.push({
                code: product.code,
                ean: product.ean,
                customer_code: product.customer_code,
                description: product.description,
                boxes,
                items
              })   
            } else if (row[fieldMap.productCode].toLowerCase() === 'grand total') {
              destination.readBoxTotal = parseInt(row[index]);
            } else {
              throw(`Unknown product code found: "${row[fieldMap.productCode]}"`)
            }
          }
          destinations.push(destination);
        } else {
          throw(`Unknown warehouse found: "${headers[index]}"`);
        }
      }
    }
  
    for (const destination of destinations) {
  
      const { boxes, items } = destination.products.reduce((acc, obj) => {
        acc.boxes += obj.boxes;
        acc.items += obj.items;
        return acc;
      }, { boxes: 0, items: 0 });

      if (destination.readBoxTotal !== boxes) {
        order.anomalies.push(`Box total (${destination.readBoxTotal}) is not equal to the sum of boxes of products (${boxes})`);
      }

      delete destination.readBoxTotal;
  
      order.destinations.push(destination);
      order.totals.boxes += boxes;
      order.totals.items += items;
    }
  
    return order;
  
  } catch (error) {
    throw(error);
  }

};

module.exports = {
  parseExcel
};


