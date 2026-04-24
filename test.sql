SELECT * FROM acme_nexus_raw_data.acme_raw.sales.orders;

SELECT 
    o.order_id,
    p.product_id
FROM acme_nexus_raw_data.acme_raw.sales.orders o
JOIN acme_nexus_raw_data.acme_raw.sales.products p
ON o.product_id = p.product_id;