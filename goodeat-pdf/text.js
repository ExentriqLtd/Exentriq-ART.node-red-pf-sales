const isItemInsidePDFBox = (item, pdfBox) => {
  return (
    (item.transform[4] > pdfBox[0] && item.transform[4] < pdfBox[2])
    && (item.transform[5] > pdfBox[1] && item.transform[5] < pdfBox[3])
  );
};

const getDateFromParts = (day, month, year) => {
  try {
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 10, 00).toISOString().slice(0, 10);
  } catch (error) {
    throw ('Invalid date');
  }
};

const getDatesAndNumberFromFilename = (filename) => {

  let date, number, delivery;

  const chunks = filename.replace('.pdf', '').split('_');
  if (chunks.length === 3) {
    const [ day, month, year ] = chunks[2].split('-');
    try {
      date = getDateFromParts(day, month, year);
      let deliveryDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 10, 0);
      deliveryDate.setDate(deliveryDate.getDate() + 1);
      delivery = getDateFromParts(deliveryDate.getDate(), deliveryDate.getMonth() + 1, deliveryDate.getFullYear())
    } catch (error) {
      throw('Invalid date');
    }
    number = chunks[0] + '/' + chunks[1];

    return { date, number, delivery };
  }
}

const analyzeOrder = (text, products, filename) => {

  const pdfBoxes = {
    destination: (items) => {
      const coords = [19.5, 234.5, 83.5, 525.8];
      try {
        return items.filter(x => isItemInsidePDFBox(x, coords)).filter(x => x.str.trim() !== '').map(x => x.str.trim()).join(', ');
      } catch (error) {
        return null;
      }
    }
  };
  
  /**
    0,0
    +------------->
    |
    |
    v

    y0, x0, y1, x1
   */
  
  const regexes = {
    product: /^(?<code>\d{6})\s*PLANET FARMS .*PZ\s*(?<boxes>\d*)\s*[\d,]*$/,
    totals: /^Totale Referenze\s*(?<count>\d*)\s*Totale Colli\s*(?<boxes>\d*)$/
  };

  let readProductCount = 0;
  let readBoxTotal = 0;

  const order = {
    customer: 'Goodeat',
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

  try {

    order.destinations[0].address = pdfBoxes.destination(text.items);

    const { date, number, delivery } = getDatesAndNumberFromFilename(filename);

    order.date = date;
    order.number = number;
    order.delivery = delivery;

    for (const product of products) {
      const rowIndex = text.items.findIndex(x => x.str.trim() === product.customer_code);
      if (rowIndex > -1) {
        const boxes = parseInt(text.items[rowIndex - 2].str);
        const items = product.boxItems * boxes;
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

    if (!order.delivery) {
      order.anomalies.push('Delivery date not found.');
    }

    if (!order.destinations[0].address) {
      order.anomalies.push('Destination address not found.')
    }
  
    return order;
      
  } catch (error) {
    throw(error);    
  }

};

const documentTypes = [
  {
    name: 'order',
    filename: 'Ordine Ortofrutta Dimar',
    analyzer: analyzeOrder
  }
];

const analyzeText = (text, products, filename) => {

  try {

    let result = {
      documentType: 'order',
      content: undefined
    };

    result.content = analyzeOrder(text, products, filename);
  
    return result;
  
  } catch (error) {
    throw(error);
  }

};

module.exports = {
  analyzeText
};
