const io = require("socket.io")(process.env.PORT || 5000, {
    cors: {
        origin: ["http://localhost:3000", "https://monofense.herokuapp.com"]
    }
});

let latestRoom = 1;

let users = {};

io.on("connection", socket => {

    socket.on('create', (callback) => {
        const room = "room" + latestRoom
        socket.join(room)
        latestRoom++;
        io.emit('return-rooms', getRooms());
        callback([room, [...io.sockets.adapter.rooms.get(room)]]);
    });

    socket.on("join-room", (room, callback) => {
        leaveLastRoom(socket);
        if (io.sockets.adapter.rooms.get(room).size <= 3) {
            socket.join(room);
            io.emit('return-rooms', getRooms());
            const joinedPeople = [...io.sockets.adapter.rooms.get(room)];
            io.to(room).emit("roomUpdate", [room, joinedPeople]);
            callback([room, joinedPeople]);
        }
    })

    socket.on("leave-last-room", () => {
        leaveLastRoom(socket);
    })

    socket.on("leave-room", (room) => {
        socket.leave(room);
        if (io.sockets.adapter.rooms.get(room)) {
            const joinedPeople = [...io.sockets.adapter.rooms.get(room)];
            io.to(room).emit("roomUpdate", [room, joinedPeople]);
        }
        io.emit('return-rooms', getRooms());
    })


    socket.on("get-rooms", () => {
        io.emit('return-rooms', getRooms());
    })

    socket.on("start-game", (room) => {
        console.log(room)
        const roomData = io.sockets.adapter.rooms.get(room);
        if (roomData.size >= 2) {
            [...roomData].map(val => users[val] = { room: room, cards: [], players: [] });
            io.emit('return-rooms', getRooms());
            io.to(room).emit("play-game", [...roomData], room);
            roomData.add("playing");
        }
    })

    socket.on("set-cards", (cards, room) => {
        const roomData = io.sockets.adapter.rooms.get(room);
        [...roomData].map(val => users[val] = { ...users[val], cards });
    })

    socket.on("send-message", (message, room) => {
        socket.broadcast.to(room).emit("recive-message", message)
    })

    socket.on("send-message-ingame", (message, room, username) => {
        socket.broadcast.to(room).emit("recive-message-ingame", message, socket.id, username)
    })

    socket.on("socket-room", (cb) => {
        cb(Array.from(socket.rooms));
    })

    socket.on("player-move", (oldPos, sum, turn, players, updatedPlayers, diceArr, cards) => {
        io.to([...socket.rooms][0]).emit("player-move", oldPos, sum, turn, players, updatedPlayers, diceArr, cards)
    })

    socket.on("next-turn", (turn, players, cards) => {

        const roomData = io.sockets.adapter.rooms.get([...socket.rooms][0]);
        [...roomData].map(val => users[val] = { ...users[val], cards, players });

        let newTurn = players.find(val => val.number > turn);

        if (!newTurn) newTurn = players[0].number
        else newTurn = newTurn.number;

        io.to([...socket.rooms][0]).emit("next-turn", newTurn, players, cards)
    })

    socket.on("add-player", (room, player) => {
        io.to(room).emit("add-player", player)
    })

    socket.on("fight-started", pokemonFight => {
        io.to([...socket.rooms][0]).emit("fight-started", pokemonFight)
    })

    socket.on("pokemon-play-turn", (newPokemons, method, attackingName, attackingEnemy, damage) => {
        io.to([...socket.rooms][0]).emit("pokemon-play-turn", newPokemons, method, attackingName, attackingEnemy, damage);
    })

    socket.on('disconnect', function () {

        if (users[socket.id]) {
            const roomData = [...io.sockets.adapter.rooms.get(users[socket.id].room)].filter(val => val !== "playing");

            io.to(users[socket.id].room).emit("player-left", roomData, socket.id, users[socket.id].cards, users[socket.id].players);
        }

        delete users[socket.id];

        [...io.sockets.adapter.rooms].map((room) => {
            if ([...room[1]][0] === "playing")
                io.sockets.adapter.rooms.delete(room[0]);
        })
    });

})


const getRooms = () => {
    let arr = Array.from(io.sockets.adapter.rooms);
    arr = arr.filter(val => val[0].slice(0, 4) === "room" &&
        val[0].slice(arr[0].length - 7) !== "playing" &&
        Array.from(val[1]).pop() !== "playing");

    arr = arr.map(val => {
        val[1] = Array.from(val[1]);
        return val
    })

    return arr
}

const leaveLastRoom = (socket) => {
    if (Array.from(socket.rooms).length) {
        const lastValue = Array.from(socket.rooms).pop();
        socket.leave(lastValue)
    }
}
