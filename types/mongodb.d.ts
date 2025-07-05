import { MongoClient } from "mongodb";
import { Mongoose } from "mongoose";

interface MongooseConnection {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

declare global {
  var _mongoClientPromise: Promise<MongoClient>;
  var mongoose: MongooseConnection;
}