const getDateFromString = (stringDate) => {

  try {
    if (stringDate.length === 10) {
      return new Date(parseInt(stringDate.slice(6, 10)), parseInt(stringDate.slice(3, 5)) - 1, parseInt(stringDate.slice(0, 2)), 10, 00).toISOString().slice(0, 10);
    } else if (stringDate.length === 8) {
      return new Date(parseInt('20' + stringDate.slice(6, 8)), parseInt(stringDate.slice(3, 5)) - 1, parseInt(stringDate.slice(0, 2)), 10, 00).toISOString().slice(0, 10);
    }
  } catch (error) {
    throw ('Invalid date');
  }

};

const analyzeOrder = (lines, products) => {

  const order = {
    customer: 'Iper',
    anomalies: [],
    number: null,
    overrides: false,
    date: null,
    delivery: null,
    destinations: [
      {
        address: null,
        from: null,
        to: null,
        products: []
      }
    ],
    totals: {
      boxes: 0,
      items: 0
    }
  };

  let m;

  m = lines[2].match(/Num Ordine\: (\d*)\s*Pag\:/);
  if (m && m[1]) {
    order.number = m[1];
  } else {
    order.anomalies.push('Order number not found');
  }

  m = lines[4].match(/Data Ordine\: ([\d\/]{10})/);
  if (m && m[1]) {
    order.date = getDateFromString(m[1]);
  } else {
    order.anomalies.push('Order date not found');
  }

  m = lines[20].match(/Data Consegna\: ([\d\/]{8})/);
  if (m && m[1]) {
    order.delivery = getDateFromString(m[1]);
  } else {
    order.anomalies.push('Order delivery date not found');
  }

  order.destinations[0].address = lines[15].substring(35, 55).trim() + ', ' + lines[16].substring(35, 55).trim();

  const totalsIndex = lines.findIndex(x => x.startsWith('TOTALE UVC'));

  if (totalsIndex) {
    for (let index = 27; index < totalsIndex - 1; index++) {
      const product = {};
      const matchingProduct = products.find(x => x.customer_code === lines[index].substring(0, 15).trim());
      if (matchingProduct) {

        let boxes, items, boxItems;

        try {
          boxes = parseInt(lines[index].substring(77, 80).trim());
        } catch (error) {
          order.anomalies.push('Number of boxes not found');
          boxes = 0;
        }

        try {
          items = parseInt(lines[index].substring(92, 95).trim()); 
        } catch (error) {
          order.anomalies.push('Number of items not found');
          items = 0;
        }

        try {
          boxItems = parseInt(lines[index].substring(86, 89).trim()); 
          if (items !== boxes * boxItems) {
            order.anomalies.push(`Number of items (${items}) is not equal to number of boxes (${boxes}) times items per box (${boxItems})`);
          }
          if (boxItems !== matchingProduct.boxItems) {
            order.anomalies.push(`Items per box (${boxItems}) is different from the configured value (${matchingProduct.boxItems})`);
          }
        } catch (error) {
          order.anomalies.push('Items per box not found');
        }

        order.destinations[0].products.push({
          code: matchingProduct.code,
          customer_code: matchingProduct.customer_code,
          ean: matchingProduct.ean,
          description: matchingProduct.description,
          boxes,
          items
        });
        order.totals.boxes += boxes;
        order.totals.items += items;
      } else {
        order.anomalies.push(`Unknown product: ${lines[index].substring(0, 15).trim()}`);
      }
    }
  }

  return order;

};

const analyzeText = (text, products) => {

  try {
    let result = {
      documentType: 'order',
      content: analyzeOrder(text.items.map(x => x.str.trim()), products)
    };  
    return result;
  
  } catch (error) {
    throw(error);
  }

};

module.exports = {
  analyzeText
};
