const http = require('http');
const ws = require('ws');
const express = require('express');

const staticServer = express.static(__dirname);
const PORT = 8001;

const connections = [];
const meshes = new Map();
const paints = new Map();
const players = new Map();
let dataIds = 0;
const _getDataId = () => (dataIds++) + '';
const dataQueue = new Map();

const server = http.createServer((req, res) => {
  // console.log('got request', req.url);

  if (req.method === 'GET') {
    let match;
    if (req.url === '/') {
      res.statusCode = 302;
      res.setHeader('Location', '/index.html');
      res.end();
    } else if (match = req.url.match(/\.(html|js|png)$/)) {
      const type = (() => {
        switch (match[1]) {
          case 'html': return 'text/html';
          case 'js': return 'application/javascript';
          default: return 'text/plain';
        }
      })();
      res.setHeader('Content-Type', type);

      staticServer(req, res, () => {
        res.statusCode = 404;
        res.end();
      });

      /* fetch('file:///package' + req.url)
        .then(proxyRes => {
          if (proxyRes.ok) {
            return proxyRes.arrayBuffer()
              .then(arrayBuffer => {
                const type = (() => {
                  switch (match[1]) {
                    case 'html': return 'text/html';
                    case 'js': return 'application/javascript';
                    default: return 'text/plain';
                  }
                })();
                res.setHeader('Content-Type', type);

                const buffer = Buffer.from(arrayBuffer);
                res.end(buffer);
              });
          } else {
            res.statusCode = proxyRes.status;
            res.end();
            return null;
          }
        })
        .catch(err => {
          console.warn(err.stack);
          res.statusCode = 500;
          res.end();
        }); */
    } else if (match = req.url.match(/^\/data\/(.+)$/)) {
      const id = match[1];
      let data = dataQueue.get(id);
      if (data) {
        // data = Buffer.from(data);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.end(data);

        dataQueue.delete(id);
      } else {
        res.statusCode = 404;
        res.end();
      }
    } else {
      res.statusCode = 404;
      res.end();
    }
  } else if (req.method === 'PUT') {
    let match;
    if (match = req.url.match(/\/mesh\/(.+?)$/)) {
      const id = match[1];

      const bs = [];
      req.on('data', d => {
        bs.push(d);
      });
      req.on('end', () => {
        const b = Buffer.concat(bs);
        meshes.set(id, b);

        // console.log('set terrain mesh data', [id, b.constructor.name, new Uint32Array(b.buffer, b.byteOffset, 1)[0]]); // XXX

        for (let i = 0; i < connections.length; i++) {
          const c = connections[i];
          if (c.readyState === ws.OPEN && !c.isHost) {
            const dataId = _getDataId();
            const updateSpecs = [
              JSON.stringify({
                method: 'mesh',
                type: 'update',
                id,
                dataId,
              }),
            ];

            for (let j = 0; j < updateSpecs.length; j++) {
              c.send(updateSpecs[j]);
            }
            dataQueue.set(dataId, b);
          }
        }

        res.end();
      });
    } else if (match = req.url.match(/\/paint\/(.+?)$/)) {
      const id = match[1];

      const bs = [];
      req.on('data', d => {
        bs.push(d);
      });
      req.on('end', () => {
        const b = Buffer.concat(bs);
        paints.set(id, b);

        // console.log('set terrain mesh data', [id, b.constructor.name, new Uint32Array(b.buffer, b.byteOffset, 1)[0]]); // XXX

        for (let i = 0; i < connections.length; i++) {
          const c = connections[i];
          if (c.readyState === ws.OPEN && !c.isHost) {
            const dataId = _getDataId();
            const updateSpecs = [
              JSON.stringify({
                method: 'paint',
                type: 'update',
                id,
                dataId,
              }),
            ];

            for (let j = 0; j < updateSpecs.length; j++) {
              c.send(updateSpecs[j]);
            }
            dataQueue.set(dataId, b);
          }
        }

        res.end();
      });
    } else {
      res.statusCode = 404;
      res.end();
    }
  } else if (req.method === 'DELETE') {
    let match;
    if (match = req.url.match(/^\/mesh\/(.+?)$/)) {
      const id = match[1];

      if (meshes.has(id)) {
        meshes.delete(id);

        for (let i = 0; i < connections.length; i++) {
          const c = connections[i];
          if (c.readyState === ws.OPEN && !c.isHost) {
            const updateSpecs = [
              JSON.stringify({
                method: 'mesh',
                type: 'remove',
                id,
              }),
            ];

            for (let j = 0; j < updateSpecs.length; j++) {
              c.send(updateSpecs[j]);
            }
          }
        }

        res.end();
      } else {
        res.statusCode = 404;
        res.end();
      }
    } else if (match = req.url.match(/^\/paint$/)) {
      paints.clear();

      for (let i = 0; i < connections.length; i++) {
        const c = connections[i];
        if (c.readyState === ws.OPEN && !c.isHost) {
          const updateSpecs = [
            JSON.stringify({
              method: 'paint',
              type: 'clear',
            }),
          ];

          for (let j = 0; j < updateSpecs.length; j++) {
            c.send(updateSpecs[j]);
          }
        }
      }
    } else {
      res.statusCode = 404;
      res.end();
    }
  } else {
    res.statusCode = 404;
    res.end();
  }
});

const wss = new ws.Server({
  server,
});
wss.on('connection', (c, req) => {
  console.log('open connection');

  c.isHost = /\?host=true/.test(req.url);
  c.playerId = Math.random().toString(36).substring(7);

  // c.mesh = _makePlayerMesh();
  // scene2.add(c.mesh);

  const _sendTerrains = () => {
    const updateSpecs = [];
    meshes.forEach((data, id) => {
      const dataId = _getDataId();
      updateSpecs.push(
        JSON.stringify({
          method: 'mesh',
          type: 'new',
          id,
          dataId,
        }),
      );
      dataQueue.set(dataId, data);
    });
    for (let i = 0; i < updateSpecs.length; i++) {
      c.send(updateSpecs[i]);
    }
  };
  const _sendPaints = () => {
    const updateSpecs = [];
    paints.forEach((data, id) => {
      const dataId = _getDataId();
      updateSpecs.push(
        JSON.stringify({
          method: 'paint',
          type: 'update',
          id,
          dataId,
        }),
      );
      dataQueue.set(dataId, data);
    });
    for (let i = 0; i < updateSpecs.length; i++) {
      c.send(updateSpecs[i]);
    }
  };
  const _sendPlayers = () => {
    const updateSpecs = [];
    players.forEach((player, id) => {
      const {position, rotation, controllers} = player;
      updateSpecs.push(
        JSON.stringify({
          method: 'transform',
          players: [
            {
              type: 'update',
              id,
              position,
              rotation,
              controllers,
            },
          ],
        }),
      );
    });
    for (let i = 0; i < updateSpecs.length; i++) {
      c.send(updateSpecs[i]);
    }
  };
  if (!c.isHost) {
    _sendTerrains();
  }
  _sendPaints();
  _sendPlayers();

  connections.push(c);

  const _getOtherConnections = () => connections.filter(c2 => c2 !== c);

  c.on('message', data => {
    if (typeof data === 'string') {
      const message = JSON.parse(data);
      const {method} = message;

      switch (method) {
        /* case 'mesh': {
          const {type} = message;

          if (type === 'new' || type === 'update') {
            const {id, dataId} = message;

            const terrainMesh = _getTerrainMesh(id);
            terrainMesh.promise = terrainMesh.promise.finally(() =>
              fetch('/data/' + dataId)
                .then(res => res.ok ? res.arrayBuffer() : Promise.reject(new Error('not ok')))
                .then(arrayBuffer => {
                  let i = 0;
                  const vertexCount = new Uint32Array(arrayBuffer, i, 1)[0];
                  i += Uint32Array.BYTES_PER_ELEMENT;
                  const vertexArray = new Float32Array(arrayBuffer, i, vertexCount);
                  i += Float32Array.BYTES_PER_ELEMENT * vertexCount;

                  const uvCount = new Uint32Array(arrayBuffer, i, 1)[0];
                  i += Uint32Array.BYTES_PER_ELEMENT;
                  const uvArray = new Float32Array(arrayBuffer, i, uvCount);
                  i += Float32Array.BYTES_PER_ELEMENT * uvCount;

                  const textureDataSize = new Uint32Array(arrayBuffer, i, 1)[0];
                  i += Uint32Array.BYTES_PER_ELEMENT;
                  const textureData = new Uint8Array(arrayBuffer, i, textureDataSize);
                  i += Uint8Array.BYTES_PER_ELEMENT * textureDataSize;

                  let textureImagePromise;
                  if (textureData.length > 0) {
                    return new Promise((accept, reject) => {
                      const objectUrl = URL.createObjectURL(new Blob([textureData], {type: 'image/jpeg'}));

                      const textureImage = new Image();
                      textureImage.onload = () => {
                        createImageBitmap(textureImage)
                          .then(accept, reject)
                          .finally(() => {
                            URL.revokeObjectURL(objectUrl);
                          });
                      };
                      textureImage.onerror = reject;
                      textureImage.src = objectUrl;
                    })
                      .then(textureImage => {
                        const update = {
                          vertexArray,
                          vertexCount,
                          uvArray,
                          uvCount,
                          textureData,
                          textureImage,
                        };
                        _loadTerrainMesh(terrainMesh, update);
                      });
                  } else {
                    return Promise.resolve(null);
                  }
                })
                .catch(err => {
                  console.warn(err.stack);
                })
            );
          } else {
            const {id} = message;
            const index = terrainMeshes.findIndex(terrainMesh => terrainMesh.meshId === id);
            if (index !== -1) {
              const terrainMesh = terrainMeshes[index];
              _removeTerrainMesh(terrainMesh);
              terrainMeshes.splice(index, 1);
            }
          }

          break;
        } */
        case 'transform': {
          const player = message.players[0];
          const {position, rotation, controllers} = player;

          players.set(c.playerId, {
            position,
            rotation,
            controllers,
          });

          const otherConnections = _getOtherConnections();
          if (otherConnections.length > 0) {
            const updateSpec = {
              method: 'transform',
              players: [
                {
                  type: 'update',
                  id: c.playerId,
                  position,
                  rotation,
                  controllers,
                },
              ],
            };
            const updateSpecString = JSON.stringify(updateSpec);

            for (let i = 0; i < otherConnections.length; i++) {
              const c2 = otherConnections[i];

              if (c2 !== c && c2.readyState === ws.OPEN) {
                c2.send(updateSpecString);
              }
            }
          }

          break;
        }
        default: {
          console.warn('unknown client method', method);
          break;
        }
      }
    } else {
      console.warn('out of order binary message', data.byteLength);
    }
  });
  c.on('close', () => {
    console.log('close connection');

    // scene.remove(c.mesh);

    connections.splice(connections.indexOf(c), 1);

    players.delete(c.playerId);

    if (connections.length > 0) {
      const updateSpec = {
        method: 'transform',
        players: [
          {
            type: 'remove',
            id: c.playerId,
          },
        ],
      };
      const updateSpecString = JSON.stringify(updateSpec);

      for (let i = 0; i < connections.length; i++) {
        const c2 = connections[i];

        if (c2 !== c && c2.readyState === ws.OPEN) {
          c2.send(updateSpecString);
        }
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('http://127.0.0.1:' + PORT);
});
server.on('error', err => {
  console.warn('server error', err.stack);
});
