import type { Application } from 'express-serve-static-core'
import authRoutes from './src/modules/auth/authRoutes.js'
import messageRoutes from './src/modules/users/messageRoutes.js';
import userRoutes from './src/modules/users/userRoutes.js';
import groupRoutes from './src/modules/group/setup/groupRoutes.js'
export const setupRoutes=(app:Application)=>{
  app.use('/api/auth',authRoutes)
  app.use('/api/message',messageRoutes);
  app.use('/api/user',userRoutes);
  app.use('/api/group',groupRoutes)
}
