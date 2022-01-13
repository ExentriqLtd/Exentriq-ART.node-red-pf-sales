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

const matchingProductByCustomerCode = (customerCode, products) => {
  const product = products.find(x => x.customer_code === customerCode);
  return product ? product : null;
};

const matchingWarehouseByName = (name, warehouses) => {
  const warehouse = warehouses.find(x => x.name.split('|').indexOf(name) > -1);
  return warehouse ? warehouse : null;
};

const parseOldExcel = async (excelBuffer, products, warehouses) => {

  // const rows = await readXlsxFile(Readable.from(excelBuffer));
  const rows = await readXlsxFile(bufferToStream(excelBuffer));

  const destinations = rows.slice(1).reduce((acc, obj) => {

    if (acc.map(x => x.name).indexOf(obj[0]) === -1) {

      const warehouse = matchingWarehouseByName(obj[0], warehouses);
      let address;
      if (warehouse) {
        address = `${warehouse.address} - ${warehouse.city}`;
      }

      acc.push({
        name: obj[0],
        address,
        from: null,
        to: null,
        products: []
      });
    }

    const index = acc.map(x => x.name).findIndex(x => x === obj[0]);
    if (index > -1) {

      const product = matchingProductByEAN(obj[2].toString(), products);

      if (product) {
        const boxes = obj[4];
        if (!isNaN(boxes)) {
          acc[index].products.push({
            code: product.code,
            ean: product.ean,
            customer_code: product.customer_code,
            description: product.description,
            boxes,
            items: boxes * product.boxItems
          });  
        }
      }
    }
    return acc;
  }, []);

  return destinations;
};

const parseNewExcel = async (excelBuffer, products, warehouses) => {

  // const rows = await readXlsxFile(Readable.from(excelBuffer));
  const rows = await readXlsxFile(bufferToStream(excelBuffer));


  const headers = rows[0];

  const fieldMap = {
    warehouseName: headers.indexOf('RAGIONE_SOCIALE'),
    boxes: headers.indexOf('QUANTITA_ORDINATA'),
    productCode: headers.indexOf('CODICE_ARTICOLO'),
  };

  const destinations = rows.slice(1).reduce((acc, obj) => {
    if (acc.map(x => x.name).indexOf(obj[fieldMap.warehouseName]) === -1) {
      const warehouse = matchingWarehouseByName(obj[fieldMap.warehouseName], warehouses);
      let address;
      if (warehouse) {
        address = `${warehouse.address} - ${warehouse.city}`;
      }
      acc.push({
        name: obj[fieldMap.warehouseName],
        address,
        from: null,
        to: null,
        products: []
      });
    }

    const index = acc.map(x => x.name).findIndex(x => x === obj[fieldMap.warehouseName]);
    if (index > -1) {

      const product = matchingProductByCustomerCode(obj[fieldMap.productCode].toString(), products);

      if (product) {
        const boxes = obj[fieldMap.boxes];
        if (!isNaN(boxes)) {
          acc[index].products.push({
            code: product.code,
            ean: product.ean,
            customer_code: product.customer_code,
            description: product.description,
            boxes,
            items: boxes * product.boxItems
          });  
        }
      }
    }
    return acc;

  }, []);

  return destinations;

};

const parseExcel = async (xlsx, products, warehouses, date) => {

  const switchDate = new Date(2021, 10, 10);
  const order = {
    destinations: [],
    totals: {
      boxes: 0,
      items: 0
    }
  };

  let destinations;
  if (date < switchDate) {
    destinations = await parseOldExcel(xlsx, products, warehouses);
  } else {
    destinations = await parseNewExcel(xlsx, products, warehouses);
  }

  for (const destination of destinations) {

    const { boxes, items } = destination.products.reduce((acc, obj) => {
      acc.boxes += obj.boxes;
      acc.items += obj.items;
      return acc;
    }, { boxes: 0, items: 0 });

    order.destinations.push(destination);
    order.totals.boxes += boxes;
    order.totals.items += items;
  }

  return order;

};

module.exports = {
  parseExcel
};


