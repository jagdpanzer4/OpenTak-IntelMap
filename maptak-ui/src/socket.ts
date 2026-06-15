import { io } from 'socket.io-client'

// Same-origin — cookies auth passes through automatically from iframe
export const socket = io('/socket.io', { autoConnect: false })
