"use client";

import { MessagesHeader, RoomMessages } from "@/components";
import { RoomPreviewList } from "@/components/Room/RoomPreviewList";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useParams } from "next/navigation";
import { pageRoomMessagesQuery } from "@/__generated__/pageRoomMessagesQuery.graphql";

const RoomMessagesQuery = graphql`
  query pageRoomMessagesQuery($roomId: ID!) {
    rooms {
      ...RoomPreviewListFragment
    }
    roomMessages(roomId: $roomId) {
      ...RoomMessagesListFragment
    }
  }
`;

const RoomMessagesPage = () => {
  const { roomId } = useParams<{ roomId: string }>();

  // TODO: discover how to use usePreloadedQuery hook instead
  const { rooms, roomMessages } = useLazyLoadQuery<pageRoomMessagesQuery>(
    RoomMessagesQuery,
    { roomId },
  );

  return (
    <main className="grid grid-cols-[auto_1fr]">
      <RoomPreviewList fragmentRef={rooms} />
      <div className="flex flex-col h-screen">
        <MessagesHeader />
        <RoomMessages messagesFragment={roomMessages} roomId={roomId} />
      </div>
    </main>
  );
};

export default RoomMessagesPage;
