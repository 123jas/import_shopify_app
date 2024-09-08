

import { useFetcher } from "@remix-run/react";
import { Page, Button, DropZone, Banner, Text } from "@shopify/polaris";
import { useState,useEffect } from "react";
import papa from 'papaparse';
 
import axios from "axios";
import { authenticate } from "../shopify.server";
// import Metafields from "./app.metafields";
// import { text } from "stream/consumers";/
require('dotenv').config();

const shopifyToken = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const shopDomain = process.env.SHOPIFY_STORE_DOMAIN;
const shopifyVersion = process.env.SHOPIFY_API_VERSION;
 

// const { papa } = pkg;
export async function loader({ request }) {
  await authenticate.admin(request);
  return null;
};


async function extractProducts(products) {
   const errors = [];


  for (const product of products) {
    
    try {
     
      const productResponse = await axios.post(
        `https://${shopDomain}/admin/api/${shopifyVersion}/products.json`,
        {
          product: {
            title: product.Title,
            body_html: product.Body_HTML,
            handle : product.Handle,
            product_type: product.Type,
            tags: product.Tags,
            Published: product.Published,
            options : [
              {
                name: product.Option1_key,
                value: product.Option1_Value
              }
            ],
            variants: [
              {
                option1: product.Option1_Value,
                price: product.Variant_Price,
                grams: product.Grams,
                Tags: product.Tags,
                compare_at_price: product.compare_at_price,
                inventory_management: "shopify",
                inventory_quantity: product.Variant_Inventory_Qty

              },
            ],
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": shopifyToken,
          },
        }
      );
    

      const productId = productResponse.data.product.id;

      // Upload image to Shopify
      const imageResponse = await axios.post(
        `https://${shopDomain}/admin/api/${shopifyVersion}/products/${productId}/images.json`,
        {
          image: {
            src: product.Image_Src,
            position: product.Image_Position
            
          }
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": shopifyToken,
            "ngrok-skip-browser-warning": "69420"
          },
        }
      );

      const MetafieldsResp = await axios.post(
        `https://${shopDomain}/admin/api/${shopifyVersion}/products/${productId}/metafields.json`,
        {
          metafield: {
            namespace: product.mf_Namespace,
            key: product.mf_key,
            value : product.mf_value,
            type : product.mf_type
            
          }
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": shopifyToken,
            "ngrok-skip-browser-warning": "69420"
          },
        }
      );


      console.log(`Product uploaded: ${productResponse.data.product.title}`);
      console.log(`Image uploaded: ${imageResponse.data.image.id}`);
      console.log(`metafields uploaded : ${MetafieldsResp.data.metafield}`)
    
    } catch (error) {
      console.error("Error uploading product:", error.response?.data || error.message);
      
      errors.push({
        product: product.title,
        error: error.response?.data || error.message,
      });

      
    }
  }
  return {success : errors.length === 0 };
}

async function getProductList(get_string) {
  try {
    const get_response = await axios.get(
      `https://${shopDomain}/admin/api/${shopifyVersion}/products.json?handle=${get_string}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": shopifyToken,
        },
      }
    );

    return get_response;
  } 
  catch (error) {
    return error;
  }
   
}

async function uploadComplementaryProducts(products) {
 
  const errors = [];
  
  
      try {
        products = products.map(product =>{
          var pr = {...product}
          pr.Handle = pr.Handle.toLowerCase();
          return pr;
        })

        // get the ids of main products with the help 0f handle
        const main_handles = products.map(product=>product.Handle);
        const main_handles_string = main_handles.join(',');
        const handleResponse = await getProductList(main_handles_string);
        const main_products_id = handleResponse.data.products;
        const productDictionary = main_products_id.reduce((acc, main_product) => {
          acc[main_product.handle] = main_product.id;
          return acc;
        }, {});
       
 

        // get the ids of complementary products  
        const complementary_handles = products.map(product => product.complementary_products);
        const complementary_handles_string = complementary_handles.join(',');
        console.log(complementary_handles_string);
        const complementryResponse = await getProductList(complementary_handles_string);
        const complementary_responses = complementryResponse.data.products;
        
        const comp_product_dic = complementary_responses.reduce((acc, response) => {
          acc[response.handle] = response.admin_graphql_api_id;
          return acc;
        }, {});

        
        console.log("complementary product dictionary : ", comp_product_dic);
        console.log("product dictionary : ",productDictionary);


      // post the complementary products 
       for(const product of products){
        
         const simple_id = productDictionary[product.Handle]
         var graph_ids = [];
           const arr = product.complementary_products;
           console.log(arr);
           const comp_arr = arr.replace(/\s+/g, '').split(",");
         graph_ids = comp_arr.map(handle => comp_product_dic[handle.toLowerCase()])
         console.log(graph_ids);
         
         

        const referenceResopnse = await axios.post(
          `https://${shopDomain}/admin/api/${shopifyVersion}/products/${simple_id}/metafields.json`,
          {
            metafield: {
              namespace: "custom",
              key: "products_compl",
              value: JSON.stringify(graph_ids),
              type: "list.product_reference"
            },
          },
          {
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": shopifyToken,
            },
          }
        )
      
        console.log(`data using handle : ${complementryResponse.data.products[0].id}`);
        console.log(`data using referenceResopnse : ${referenceResopnse}`);
        
        

       }  
      } catch (error) {
        console.error("Error uploading product:", error.response?.data || error.message);
        
      }
  
 
  return { success: errors.length === 0 };
}

 
export async function action({ request }) {
  
  const formData = await request.formData();
  const file = formData.get("csvFile");

  if (!file) {
    return { error: "No file uploaded" };
  }

  const text = await file.text();
  const parsedData = papa.parse(text, { header: true });

  const exractValue = await extractProducts(parsedData.data);
  console.log(exractValue);
  const result = await uploadComplementaryProducts(parsedData.data);
  
  return { success: result.success, errors: result.errors };
}

export default function UploadCsv() {
  const fetcher = useFetcher();

  
  const [file, setFile] = useState(null);
  // const [uploadResult,setUpload] = useState();
  const [text2,setText] = useState(true);
  const [length,setlenght] = useState(null);
  

  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";
  

  useEffect(() => {
    if (file) {
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target.result;
        const parsedData = papa.parse(text, { header: true });
        
         
        for (var i=0;i<parsedData.data.length-1;i++){
          if (!parsedData.data[i].Title) {
            setText(false);
          }
          else if ( parsedData.data[i].Variant_Price === 0){
            setText(false);
          }
           
          setlenght(parsedData.data.length - 1);
        }
        
      }; 
      reader.readAsText(file);
    } else {
      setlenght(0);   
    }
  }, [file]);


  const handleUploadProducts = async () => {
    const formData = new FormData();
    formData.append("csvFile", file);

    fetcher.submit(formData, {
      method: "post",
      encType: "multipart/form-data",
    })

    if (!file) return;

    const text = await file.text();
    const parsedData = papa.parse(text, { header: true });

    const result = await uploadComplementaryProducts(parsedData.data);
     console.log(result);
  };


  const handleDrop = async(_dropFiles, acceptedFiles) => {
      setFile(acceptedFiles[0]);
      // const formData = new FormData();
      // formData.append("csvFile", file);
      console.log('hello');
      if (!file) return;

       
      console.log(length);

    };
 

 

  return (
    <Page>
      
      
          <DropZone onDrop={handleDrop} accept=".csv" type="file">
            {file ? (
          <DropZone.FileUpload actionTitle  = "Replace File" actionHint="file is successfully uploaded" />
            ) : (
              <DropZone.FileUpload actionHint="Upload a file" />
            )}
          </DropZone>
      {file && (text2 ? (<Text tone="success">{length} products are present</Text>): (<Banner title="File data is Invalid.." tone="warning"></Banner>) )}
     
    
          
      
      {text2?
        (<Button
          secondary
          loading={isLoading}
          disabled={!file}
          onClick={handleUploadProducts}
        >
          Publish
        </Button>) :
        (<Button
          secondary
          disabled
          onClick={handleUploadProducts}
        >
          Publish
        </Button>)}
 
    </Page>
  );
}
