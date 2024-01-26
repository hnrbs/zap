import { mutationWithClientMutationId } from "graphql-relay";
import { GraphQLNonNull, GraphQLString } from "graphql/type";
import { RoomType } from "../RoomType";
import { RoomModel } from "../RoomModel";
import { Context } from "../../../routes/graphql";
import { UserModel } from "../../user/UserModel";
import { InvalidPayloadError, UnauthorizedError } from "../../../routes/error";

export const GetOrCreateRoomMutation = mutationWithClientMutationId({
  name: "GetOrCreateRoom",
  description: "Get the room based on it participants ids or create it if it doesn't exists yet.",
  inputFields: {
    userId: { type: new GraphQLNonNull(GraphQLString) }
  },
  outputFields: {
    room: {
      type: RoomType,
      resolve: ({ room }) => room
    }
  },
  mutateAndGetPayload: async ({ userId }: { userId: string }, ctx: Context) => {
    const authUser = ctx.user;
    if (!authUser) throw new UnauthorizedError();

    const user = await UserModel.findById(userId);
    if (!user) throw new InvalidPayloadError("user not found");

    const existingRoom = await RoomModel.findOne({ $and: [
      { "participants": authUser._id },
      { "participants": user._id },
    ]}).exec();

    if (existingRoom) return { room: existingRoom };
    
    const room = new RoomModel({
      participants: [
        authUser._id,
        user._id
      ]
    });

    await room.save();

    return { room };
  }
})
