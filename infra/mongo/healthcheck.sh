#!/bin/sh
mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval '
try {
  quit(rs.status().ok === 1 ? 0 : 1);
} catch (e) {
  rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongo:27017" }] });
  quit(1);
}
'
