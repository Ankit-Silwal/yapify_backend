import express from "express";
import cookieParser from "cookie-parser";

const app=express();
app.use(express.json())
app.use(cookieParser());

app.get('/',(req,res)=>{
  res.status(200).json({
    msg:"The server is running correctly"
  })
})

export default app;