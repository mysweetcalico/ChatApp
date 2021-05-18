const { emit } = require('process');

const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

const port = 5000;

server.listen(port, () => {
    console.log(`Listening to server at: http://localhost:${port}`)
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// set up a route for the chat room
app.get('/chat', (req, res) => {
    res.sendFile(__dirname + '/chat.html');
});

// create a namespace
const chat = io.of('/chat');
let users = {}; //js object that maps nickname: socket

chat.on('connection', (socket) => {

    socket.on('join', () => {
        chat.emit('notification', {user: socket.nickname, msg: `is connected`});
    })

    socket.on('send message', (data, callback) => {
        let msg = data.trim();
        let whisper = msg.substr(0, 3);
        if (whisper === 'w/ ') {
            msg = msg.substr(3);
            let firstSpace = msg.indexOf(' ');
            if (firstSpace !== -1) {
                let name = msg.substring(0, firstSpace);
                msg = msg.substring(firstSpace + 1);
                if (name in users) {
                    users[name].emit('whisper', {user: socket.nickname, msg: msg});
                    callback({isValid: true, msg:''});
                } else {
                    callback({isValid: false, msg: 'Error! Please enter a valid member'});
                }
            } else {
                callback({isValid: false, msg: 'Error! Please enter a message for your callback'});
            }
        } else {
            socket.broadcast.emit('new message to others', {user: socket.nickname, msg: data});
            // chat.to(socket.id).emit('new message to self', {user: socket.nickname, msg: data});
            socket.emit('new message to self', {user: socket.nickname, msg: data});
        }
    });

    socket.on('disconnect', () => {
        let userLeaving = socket.nickname;
        delete users[userLeaving];
        chat.emit('usernames', Object.keys(users));
        chat.emit('notification', {user: userLeaving, msg: `is disconnected`});
        chat.emit('number of users', Object.keys(users).length);
    });

    socket.on('new user', (name, callback) => {
        if (!name || name in users) {
            callback(false);
        } else {
            callback(true);
            socket.nickname = name; //each user has its own socket, and attach the nickname to the socket
            users[socket.nickname] = socket;
            chat.emit('usernames', Object.keys(users));
            chat.emit('number of users', Object.keys(users).length);
        }
    });

    //private message
    socket.on('private message request', (recipient, callback) => {
        if (recipient in users) {
            if (recipient === socket.nickname) {
                callback({isValid: false, msg: `Error! Please enter a member who isn't yourself`});
            } else {
                callback({isValid: true, msg: `Good`});
                socket.emit(`private message enabled`, recipient);
                users[recipient].emit(`private message enabled`, socket.nickname);
            }
        } else {
            callback({isValid: false, msg: `Error! Please enter a valid member`});
        }
    });

    socket.on('send private message', (data) => {
        users[data.recipient].emit('private message from sender', {from: socket.nickname, msg: data.msg} );
        socket.emit('private message from self', data.msg);
    });

    //'user is typing' functionality
    socket.on('typing', () => {
        socket.broadcast.emit('display typing', {user: socket.nickname});
    });

    socket.on('typing ends', () => {
        socket.broadcast.emit('remove typing');
    })
});
