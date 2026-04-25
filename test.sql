SELECT * FROM acme_nexus_redshift.enterprise_dw.public.executive_sales_summary

SELECT 
    t.total_orders,
    p.total_revenue
FROM acme_nexus_redshift.enterprise_dw.public.executive_sales_summary.total_orders t
JOIN acme_nexus_redshift.enterprise_dw.public.executive_sales_summary.total_revenue p
ON t.total_orders = p.total_revenue;