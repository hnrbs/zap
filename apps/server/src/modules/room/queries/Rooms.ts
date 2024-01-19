import { GraphQLFieldConfig, GraphQLNonNull } from "graphql";
import { GraphQLContext } from "../../../schemas/context";
import { RoomConnection } from "../RoomType";
import { RoomModel } from "../RoomModel";
import { connectionFromMongoCursor, mongooseLoader } from "@entria/graphql-mongoose-loader";
import DataLoader from "dataloader";
import { UnauthorizedError } from "../../../routes/error";

export const Rooms: GraphQLFieldConfig<any, GraphQLContext> = {
  type: new GraphQLNonNull(RoomConnection.connectionType),
  description: "List user's rooms",
  resolve: async (_source, args, context) => {
    const user = context.user;

    if (!user) {
      throw new UnauthorizedError
    };

    const loader = new DataLoader<string, Promise<any[]>>(ids => {
      return mongooseLoader(RoomModel, ids);
    });

    return connectionFromMongoCursor({
      cursor: RoomModel.find({ "participants._id": user._id }).sort({ lastMessage: -1, "lastMessage.createdAt": 1 }),
      context,
      args,
      loader: (_, id) => loader.load(id.toString()),
    });
  }
}
