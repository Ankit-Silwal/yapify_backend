import type { Application } from 'express-serve-static-core'
import authRoutes from './src/modules/auth/authRoutes.js'
import messageRoutes from './src/modules/users/messageRoutes.js';

export const setupRoutes=(app:Application)=>{
  app.use('/api/auth',authRoutes)
  app.use('/api/message',messageRoutes);
}
