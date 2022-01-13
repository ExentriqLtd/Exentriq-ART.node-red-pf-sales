# pf-sales

Node-RED nodes for Planet Farms order ingestion automation.

Each node outputs a structure that will be submitted to Elastisearch (see below).

## Managed Customers

* Esselunga
* Ortofin (Iper)
* Rialto (Il Gigante)
* Gorillas
* Goodeat
* Glovo
* Getir
* Dimar (Mercatò)
* Helbiz

## Elasticsearch configuration

Three indices are used:

* `orders`
* `orders-flat`
* `confirmations`

The `confirmations` index must be configured with the following mapping:

~~~http
PUT /confirmations/_mapping
{
  "properties": {
    "timestamp": {
      "type": "date"
    },
    "entity": {
      "properties": {
        "products": {
          "properties": {
            "total_cost": {
              "type": "float"
            },
            "unit_cost": {
              "type": "float"
            }
          }
        },
        "totals": {
          "properties": {
            "cost": {
              "type": "float"
            }
          }
        }
      }
    }
  }
}
~~~

The `orders` index must be configured with the following mapping:

~~~http
PUT /orders/_mapping
{
  "properties": {
    "timestamp": {
      "type": "date"
    }
  }
}
~~~

The `orders-flat` index must be configured with the following mapping:

~~~http
PUT /orders-flat/_mapping
{
  "properties": {
    "timestamp": {
      "type": "date"
    }
  }
}
~~~
