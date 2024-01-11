import { Search } from "@/components";
import { graphql, useFragment } from "react-relay";
import { RoomPreview } from "./RoomPreview";
import { RoomPreviewListFragment$key } from "@/__generated__/RoomPreviewListFragment.graphql";

const roomPreviewListFragment = graphql`
  fragment RoomPreviewListFragment on RoomConnection {
    edges {
      node {
        id
        ...RoomPreviewFragment
      }
    }
  }
`;

export const EmptyState = () => {
  return (
    <div className="absolute h-full w-full flex items-center justify-center px-6">
      <div className="bg-secondary-100/60 flex items-center justify-center text-center w-full max-w-xs py-7 rounded-3xl flex-col px-4">
        <p className=" font-semibold text-lg text-secondary-950/90">
          Your chats will appear here
        </p>
        <p className="text-secondary-900/70">
          Looks like your conversations are playing hide and seek. Don't worry,
          they're just a bit shy!
        </p>
      </div>
    </div>
  );
};

export const RoomPreviewList = ({
  fragmentRef,
}: {
  fragmentRef: RoomPreviewListFragment$key;
}) => {
  const data = useFragment(roomPreviewListFragment, fragmentRef);
  if (!data) return;
  const { edges } = data;

  return (
    <section className="relative min-w-64 max-w-md lg:w-[33vw] xl:w-[25vw] bg-white shadow py-2 flex flex-col gap-2 h-screen z-10">
      <div className="px-3">
        <Search />
      </div>
      {edges && edges.length > 0 && (
        <div className="h-full max-h-full flex flex-col overflow-y-auto px-3">
          {edges.map((edge) => {
            const room = edge?.node;
            if (!room) return;

            return <RoomPreview key={room.id} fragmentKey={room} />;
          })}
        </div>
      )}
      <EmptyState />
    </section>
  );
};
