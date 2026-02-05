import "dotenv/config";
import http from "http";
import app from "./app.ts";

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`The server is running on the port number ${PORT}`);
});
