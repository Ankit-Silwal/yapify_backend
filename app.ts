import express from "express";
import cookieParser from "cookie-parser";
import {connectDB} from './src/config/db.ts'
import { setupRoutes } from "./routes.ts";
import { initRedis } from "./src/config/redis.ts";

const app=express();
app.use(express.json())
app.use(cookieParser());
connectDB();
initRedis();
setupRoutes(app)
app.get('/',(req,res)=>{
  res.status(200).json({
    msg:"The server is running correctly"
  })
})

export default app;