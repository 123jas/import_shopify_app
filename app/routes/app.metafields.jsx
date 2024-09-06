import axios from "axios";
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node"; 
import { useLoaderData } from "@remix-run/react";

const SHOPIFY_ADMIN_API_ACCESS_TOKEN = "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";

export async function loader({ request }) {
    await authenticate.admin(request);

    try {
        const productResponse = await axios.get(
            `https://my-app-sho.myshopify.com/admin/api/2024-07/products.json?handle=pearl-perched-parrot-golden-elegance-1`,
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": SHOPIFY_ADMIN_API_ACCESS_TOKEN,
                },
            }
        );

        // Access the data properly
        const products = productResponse.data.products;
        const product = products[0];

       
        return product;
         // Use `json` to return the data properly
    } catch (error) {
        console.log(error);
        return json({ error: "Failed to fetch product" }); // Return an error message
    }
}
export default function Csv() {
    const product = useLoaderData(); // This will receive the product object
    
    // Safely access product properties
    return (
        <>
             {product.id}
            {product.admin_graphql_api_id}
        </>
    );
}