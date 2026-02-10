import "dotenv/config";
import http from "http";
import app from "./app.ts";
import { initSocket } from "./src/realtime/io.js";
import registerHandlers from "./src/realtime/handler.js";

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize Socket.IO
const io = initSocket(server);
registerHandlers(io);

server.listen(PORT, () => {
  console.log(`The server is running on the port number ${PORT}`);
});
