const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);

app.use(express.static(__dirname + '/public'));

const PORT = process.env.PORT || 3000;

const gameState = {
  players: {},
  beacons: {},
  walls: {}, 
  mines: {}
};

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);
  gameState.players[socket.id] = {
    x: 250,
    y: 250,
    width: 25,
    height: 25,
    gold : 0
  };

  socket.on('disconnect', function () {
    console.log('user disconnected');
    const playerId = socket.id;

    // Delete player, beacons, and mines
    delete gameState.players[playerId];
    delete gameState.beacons[playerId];
    delete gameState.mines[playerId];

    // Delete walls associated with the disconnected player
    for (let wallId in gameState.walls) {
      if (gameState.walls[wallId].beaconId === playerId) {
        delete gameState.walls[wallId];
      }
    }
  });

  socket.on('playerMovement', (playerMovement) => {
    const player = gameState.players[socket.id];
    const canvasWidth = 900;
    const canvasHeight = 600;
  
    // Store the next position based on the movement
    let nextX = player.x;
    let nextY = player.y;
  
    if (playerMovement.left && player.x > 0) {
      nextX = player.x - 4;
    }
    if (playerMovement.right && player.x < canvasWidth - player.width) {
      nextX = player.x + 4;
    }
    if (playerMovement.up && player.y > 0) {
      nextY = player.y - 4;
    }
    if (playerMovement.down && player.y < canvasHeight - player.height) {
      nextY = player.y + 4;
    }
  
    // Check for collisions with walls
    const playerRect = {
      x: nextX,
      y: nextY,
      width: player.width,
      height: player.height,
    };
  
    let collided = false;
  
    // Iterate through walls and check for collisions
    for (let wallId in gameState.walls) {
      const wall = gameState.walls[wallId];
      const wallRect = {
        x: wall.x,
        y: wall.y,
        width: wall.width,
        height: wall.height,
      };
  
      if (
        playerRect.x < wallRect.x + wallRect.width &&
        playerRect.x + playerRect.width > wallRect.x &&
        playerRect.y < wallRect.y + wallRect.height &&
        playerRect.y + playerRect.height > wallRect.y
      ) {
        collided = true;
        break;
      }
    }
  
    // If no collision detected, update player position
    if (!collided) {
      player.x = nextX;
      player.y = nextY;
    }
  });

  socket.on('placeBeacon', () => {
    const player = gameState.players[socket.id];
    const beaconWidth = 200;
    const beaconHeight = 200;
  
    // Assigning a beacon to the player ID
    gameState.beacons[socket.id] = {
      x: player.x + (player.width / 2) - (beaconWidth / 2) + 10,
      y: player.y - beaconHeight + 10,
      width: beaconWidth,
      height: beaconHeight,
      color: '#77f77d'
    };
  });
  
  socket.on('placeWall', (position) => {
    const wallWidth = 25;
    const wallHeight = 25;
    const playerId = socket.id;

     // Check if the player has enough gold to place a wall
  if (gameState.players[playerId].gold >= 10) {
    // Deduct 10 gold from the player
    gameState.players[playerId].gold -= 10;

  
    const playerBeacon = gameState.beacons[playerId]; // Fetching the player's beacon
  
    if (playerBeacon) {
      const roundedX = Math.floor(position.x); // Round to nearest whole pixel
      const roundedY = Math.floor(position.y); // Round to nearest whole pixel
  
      // Check if the placement is within the beacon area
      if (
        roundedX >= playerBeacon.x &&
        roundedX <= playerBeacon.x + playerBeacon.width - wallWidth &&
        roundedY >= playerBeacon.y &&
        roundedY <= playerBeacon.y + playerBeacon.height - wallHeight
      ) {
        // Calculate the grid-aligned position for wall placement
        const gridAlignedX = Math.floor((roundedX - playerBeacon.x) / wallWidth) * wallWidth + playerBeacon.x;
        const gridAlignedY = Math.floor((roundedY - playerBeacon.y) / wallHeight) * wallHeight + playerBeacon.y;
  
        const wallId = playerId + '_' + Object.keys(gameState.walls).length;
  
        // Check if there's already a wall at the grid-aligned position
        let wallAlreadyExists = false;
        for (let existingWallId in gameState.walls) {
          const existingWall = gameState.walls[existingWallId];
          if (
            existingWall.x === gridAlignedX &&
            existingWall.y === gridAlignedY &&
            existingWall.beaconId === playerId
          ) {
            wallAlreadyExists = true;
            break;
          }
        }
  
        // Place the wall if there's no wall at the grid-aligned position
        if (!wallAlreadyExists) {
          gameState.walls[wallId] = {
            x: gridAlignedX,
            y: gridAlignedY,
            width: wallWidth,
            height: wallHeight,
            beaconId: playerId,
          };
        }
      }
    } else {
      // Player doesn't have enough gold, send a message or handle it as needed
      console.log('Player does not have enough gold to place a wall.');
    }
  }
  });
  

  socket.on('placeMine', (position) => {
    const mineWidth = 20;
    const mineHeight = 20;
  
    const playerBeacon = gameState.beacons[socket.id]; // Fetching the player's beacon
  
    if (playerBeacon) {
      if (
        position.x >= playerBeacon.x &&
        position.x <= playerBeacon.x + playerBeacon.width &&
        position.y >= playerBeacon.y &&
        position.y <= playerBeacon.y + playerBeacon.height
      ) {
        gameState.mines[socket.id] = {
          x: position.x - (mineWidth / 2),
          y: position.y - (mineHeight / 2),
          width: mineWidth,
          height: mineHeight,
        };
      }
    }
  });
  
  // Increase player gold if a mine is active for that player
  setInterval(() => {
    for (let playerId in gameState.mines) {
      const player = gameState.players[playerId];
      if (player) {
        player.gold += 1;
      }
    }
  }, 1000);

  setInterval(() => {
    io.sockets.emit('state', gameState);
  }, 1000 / 60);
});



server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port 3000 ${PORT}`);
});
