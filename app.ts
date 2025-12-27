import express from "express";
import cookieParser from "cookie-parser";
import {connectDB} from './src/config/db.ts'
const app=express();
app.use(express.json())
app.use(cookieParser());
connectDB();
app.get('/',(req,res)=>{
  res.status(200).json({
    msg:"The server is running correctly"
  })
})

export default app;