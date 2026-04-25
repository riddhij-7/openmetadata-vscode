models = {
    "version": 2,
    "models": [
        {
            "name": "acme_nexus_raw_data.acme_raw.sales.orders",
            "description": "E-commerce order transactions.",
            "columns": [
                {
                    "name": "order_id",
                    "description": "Unique identifier for each order."
                },
                {
                    "name": "customer_id",
                    "description": "Unique identifier for the customer who placed the order."
                },
                {
                    "name": "product_id",
                    "description": "Unique identifier for the purchased product."
                },
                {
                    "name": "quantity",
                    "description": "Number of units ordered."
                },
                {
                    "name": "price",
                    "description": "Price per unit of the product."
                },
                {
                    "name": "order_date",
                    "description": "Date when the order was placed."
                },
                {
                    "name": "status",
                    "description": "Current status of the order."
                },
                {
                    "name": "created_at",
                    "description": "Timestamp when the order record was created."
                },
                {
                    "name": "updated_at",
                    "description": "Timestamp when the order record was last updated."
                }
            ]
        }
    ]
}

print(models)