const getDatesFromString = (stringDate) => {

  try {
    const order = new Date(parseInt(stringDate.slice(6, 10)), parseInt(stringDate.slice(3, 5)) - 1, parseInt(stringDate.slice(0, 2)), 10, 00);
    let delivery = order;
    delivery.setDate(order.getDate() + 1);

    return {
      order: order.toISOString().slice(0, 10),
      delivery: delivery.toISOString().slice(0, 10)
    }
  } catch (error) {
    throw ('Invalid date');
  }

};

const getWarehouseFromName = (name, warehouses) => {
  const warehouse = warehouses.find(x => x.name.toLowerCase() === name.toLowerCase().trim());
  if (warehouse) {
    return warehouse;
  } else {
    throw('Warehouse not found');
  }
};

const analyzeOrder = (items, products, warehouses) => {

  const order = {
    customer: 'Glovo',
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

  index = items.indexOf('Purchase Order #');
  if (index > -1) {
    order.number = items[index + 1];
  } else {
    order.anomalies.push('Order number not found');
  }

  index = items.indexOf('Order Date:');
  if (index > -1) {
    const orderDate = items[index + 2];
    try {
      const dates = getDatesFromString(orderDate);
      order.date = dates.order;
      order.delivery = dates.delivery;
    } catch (error) {
      order.anomalies.push('Order date is not valid');
    }
  } else {
    order.anomalies.push('Order date not found');
  }

  index = items.indexOf('Shipping address:');
  if (index > -1) {
    try {
      const warehouse = getWarehouseFromName(items[index + 2], warehouses);
      order.destinations[0].address = warehouse.address;
      order.destinations[0].from = warehouse.from;
      order.destinations[0].to = warehouse.to;
    } catch (error) {
      order.anomalies.push(`Destination warehouse "${items[index + 2]}" unknown`);
    }
  } else {
    order.anomalies.push('Destination details not found');
  }

  if (order.destinations[0].address) {

    for (const product of products) {

      const index = items.indexOf(product.ean);
      if (index > -1) {
  
        const orderProduct = {
          code: product.code,
          customer_code: product.customer_code,
          ean: product.ean,
          description: product.description,
          boxes: parseInt(items[index + 14]),
          items: parseInt(items[index + 12])
        }
        if (orderProduct.items !== orderProduct.boxes * product.boxItems) {
          order.anomalies.push(`Product "${product.description}": number of items (${orderProduct.items}) is not equal to number of boxes (${orderProduct.boxes}) multiplied by ${product.boxItems}`);
        }
        order.totals.boxes += orderProduct.boxes;
        order.totals.items += orderProduct.items;
        order.destinations[0].products.push(orderProduct);
      }
    }  
  
  }


  return order;
};


const analyzeText = (text, products, warehouses) => {

  try {

    let result = {
      documentType: 'order',
      content: undefined
    };

    result.content = analyzeOrder(text.items.map(x => x.str.trim()), products, warehouses);
  
    return result;
  
  } catch (error) {
    throw(error);
  }

};

module.exports = {
  analyzeText
};
