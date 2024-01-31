"use client";

import { MoreHorizontal, SendHorizonal } from "lucide-react";
import {
  graphql,
  useFragment,
  useMutation,
  usePaginationFragment,
} from "react-relay";
import { cn, extractNodes } from "@/utils";
import {
  Dispatch,
  RefObject,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { RoomMessagesQuery$key } from "@/__generated__/RoomMessagesQuery.graphql";
import { RoomMessagesPaginationQuery } from "@/__generated__/RoomMessagesPaginationQuery.graphql";
import { User } from "@/auth";
import { sendMessageHandler, storeMessageMutation, useStoreMessageForm } from "./messages/StoreMessage";
import { InvalidMessageDialog } from "./messages/InvalidMessageDialog";
import { StoreMessageMutation } from "@/__generated__/StoreMessageMutation.graphql";
import { useMessageAddedSubscription } from "./messages/MessageAddedSubscription";

const scrollToBottom = (divRef: RefObject<HTMLDivElement>) => {
  const div = divRef.current;
  if (!div) return;

  div.scrollTo({
    top: div.scrollHeight,
    behavior: "smooth",
  });
};

const getLastMessage = (messages: Message[]) => {
  const lastMessages = messages.slice(-1);
  if (lastMessages.length == 1) {
    return lastMessages[0];
  }

  return null;
};

const getSentAt = (message: Message) => {
  const date = new Date(message.sentAt);

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(date);
};

const MessageChunk = ({
  messages,
  isSender,
}: {
  messages: string[];
  isSender: boolean;
}) => {
  return (
    <div
      className={cn("w-full flex", isSender ? "justify-end" : "justify-start")}
    >
      <div className="flex flex-col gap-1 w-2/3">
        {messages.map((message, id) => {
          const isLastMessage = id + 1 === messages.length;
          const isFirstMessage = id == 0;

          return (
            <div
              key={id}
              className={cn("flex flex-col break-words", {
                "items-end rounded-l-full": isSender,
                "items-start rounded-r-full": !isSender,
              })}
            >
              <div className="relative mx-[7px]">
                <p
                  className={cn(
                    "px-3 py-1.5 bg-zinc-700 break-words max-w-[30rem] rounded-tl-3xl rounded-tr-3xl shadow text-stone-800",
                    {
                      "bg-white": !isSender,
                      "bg-secondary-300": isSender,
                      "rounded-l-[18px] rounded-tr-[18px] rounded-br-xl":
                        isFirstMessage && !isLastMessage && isSender,
                      "rounded-r-[18px] rounded-tl-[18px] rounded-bl-xl":
                        isFirstMessage && !isSender,
                      "rounded-bl-[18px] rounded-tr-xl rounded-br-0":
                        isLastMessage && isSender,
                      "rounded-br-[18px] rounded-tl-xl rounded-bl-0":
                        isLastMessage && !isSender,
                      "rounded-l-[18px] rounded-r-xl":
                        !isLastMessage && !isFirstMessage && isSender,
                      "rounded-r-[18px] rounded-l-xl":
                        !isLastMessage && !isFirstMessage && !isSender,
                    },
                  )}
                >
                  {message}
                </p>
                {isLastMessage && (
                  <svg
                    height={17}
                    width={7}
                    className={cn("absolute bottom-0", {
                      "fill-secondary-300 left-full": isSender,
                      "fill-white right-full -scale-x-100": !isSender,
                    })}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 7 17"
                  >
                    <path
                      d="M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z"
                      fill="inherit"
                    />
                  </svg>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// TODO
// Could not generate the message type because I couldn't map an
// array of fragments into an array of data due to rule-of-hooks.
type Message = {
  id: string;
  content: string;
  sender: {
    id: string;
    username: string;
  };
  sentAt: string;
};

const MessageGroups = ({
  messages,
  user,
}: {
  messages: Message[];
  user: User;
}) => {
  const groups = [];

  let currentGroup: Message[] = [];

  for (const message of messages) {
    const lastMessage = currentGroup[currentGroup.length - 1];

    // Split into a new group so each message sender has it own group
    if (lastMessage?.sender.id !== message.sender.id) {
      groups.push(currentGroup);
      currentGroup = [message];
      continue;
    }

    // Split into a new group if the time difference from the last messsage
    // exceeds 5 minutes
    const MAX_TIME_DIFF = 5 * 60000;
    const lastMessageTime = new Date(lastMessage.sentAt).getTime();
    const currentMessageTime = new Date(message.sentAt).getTime();
    if (currentMessageTime - lastMessageTime > MAX_TIME_DIFF) {
      groups.push(currentGroup);
      currentGroup = [message];
      continue;
    }

    currentGroup.push(message);
  }

  // Push the last group into the groups array
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return (
    <>
      {groups.map((messageGroup, id) => {
        const isSender = messageGroup[0]?.sender.id == user.id;
        const isLastGroup = id + 1 === groups.length;
        const lastMessage = getLastMessage(messageGroup);

        return (
          <div key={id}>
            <MessageChunk
              isSender={isSender}
              messages={messageGroup.map((message) => message.content)}
            />
            <div
              className={cn("flex gap-1.5 text-zinc-400", {
                "justify-end": isSender,
              })}
            >
              {isSender && isLastGroup && (
                <span className="text-sm mt-1">Sent</span>
              )}
              {lastMessage?.sentAt && (
                <span className="text-sm mt-1">{getSentAt(lastMessage)}</span>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
};

const LoadedMessages = ({ queryRef }: { queryRef: RoomMessagesQuery$key }) => {
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    RoomMessagesPaginationQuery,
    RoomMessagesQuery$key
  >(
    graphql`
      fragment RoomMessagesQuery on Query
      @argumentDefinitions(
        roomId: { type: "ID!" }
        first: { type: "Int", defaultValue: 25 }
        after: { type: "String" }
      )
      @refetchable(queryName: "RoomMessagesPaginationQuery") {
        roomMessages(roomId: $roomId, first: $first, after: $after)
          @connection(key: "messages_roomMessages", filters: []) {
          __id
          edges {
            node {
              id
              content
              sender {
                id
                username
              }
              sentAt
            }
          }
          pageInfo {
            hasNextPage
          }
        }
        me {
          id
          username
        }
        ...RoomMessagesMessagesQuery
      }
    `,
    queryRef,
  );

  const { roomMessages, me: user } = data;

  const loadMore = () => {
    if (isLoadingNext || !hasNext) return;

    loadNext(15);
  };

  const descMessages = extractNodes(roomMessages);
  const messages = descMessages.reverse();

  if (!user) return;

  return (
    <div className="pt-3">
      {hasNext && (
        <div className="flex w-full justify-center pb-3">
          <button
            type="button"
            disabled={isLoadingNext}
            className="py-1 bg-secondary-300 px-3 shadow rounded-full text-stone-800 flex items-center gap-1.5 transition hover:-translate-y-1"
            onClick={loadMore}
          >
            Load more
            <MoreHorizontal size={18} strokeWidth={1} />
          </button>
        </div>
      )}
      <MessageGroups messages={messages} user={user} />
    </div>
  );
};

const Messages = ({
  user,
  setPendingMessages,
  messagesRef,
  roomId,
}: {
  user: User;
  setPendingMessages: Dispatch<SetStateAction<string[]>>;
  messagesRef: RefObject<HTMLDivElement>;
  roomId: string;
}) => {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    scrollToBottom(messagesRef);
  }, [messages, messagesRef]);

  useMessageAddedSubscription({
    roomId,
    onMessage: (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);

      if (message.sender.id == user.id) {
        setPendingMessages((pendingMessages) =>
          pendingMessages.filter(
            (pendingMessage) => pendingMessage !== message.content,
          ),
        );
      }
    }
  })

  if (!user) return;

  return (
    <div>
      <MessageGroups messages={messages} user={user} />
    </div>
  );
};

const PendingMessages = ({ messages }: { messages: string[] }) => {
  if (!messages.length) return;

  return (
    <div>
      <MessageChunk messages={messages} isSender={true} />
      <span className="text-zinc-400 text-sm flex justify-end mt-1">
        Sending...
      </span>
    </div>
  );
};

export const RoomMessages = ({
  roomId,
  queryRef,
}: {
  roomId: string;
  queryRef: RoomMessagesQuery$key;
}) => {
  const [pendingMessages, setPendingMessages] = useState<string[]>([]);

  const [commitMutation] = useMutation<StoreMessageMutation>(storeMessageMutation);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { register, handleSubmit, setValue } = useStoreMessageForm({ roomId });
  const messagesRef = useRef<HTMLDivElement>(null);

  const onSent = (message: string) => {
    console.log({ message });
    setPendingMessages((messages) => [...messages, message]);
    setValue("content", "")
  };
  const onValidationError = (error: string) => {
    setValidationError(error);
  };

  const sendMessage = sendMessageHandler({
    commitMutation,
    onValidationError,
    onSent,
  });

  useEffect(() => {
    scrollToBottom(messagesRef);
  }, [pendingMessages, messagesRef]);

  const { me: user } = useFragment(
    graphql`
      fragment RoomMessagesMessagesQuery on Query {
        me {
          id
          username
        }
      }
    `,
    queryRef,
  );

  return (
    <>
      <form className="w-full" onSubmit={handleSubmit(sendMessage)}>
        <div
          className="
            h-[calc(100vh-64px)] mx-auto max-w-3xl px-4 sm:px-6 lg:px-8
            container flex justify-end flex-col gap-y-1.5
          "
        >
          <div className="max-h-full overflow-y-auto" ref={messagesRef}>
            <LoadedMessages queryRef={queryRef} />
            {user && (
              <Messages
                roomId={roomId}
                user={user}
                setPendingMessages={setPendingMessages}
                messagesRef={messagesRef}
              />
            )}
            <PendingMessages messages={pendingMessages} />
          </div>

          <div className="w-full pt-2 pb-4 flex items-center gap-2.5">
            <input
              placeholder="Message"
              autoCapitalize="off"
              autoComplete="off"
              className="rounded-2xl shadow px-6 py-3.5 w-full tracking-wide outline-none"
              {...register("content")}
            />
            <button
              type="submit"
              disabled={Boolean(validationError)}
              className="bg-white p-3.5 shadow rounded-full text-secondary-400 hover:bg-secondary-400 hover:text-white"
            >
              <SendHorizonal />
            </button>
          </div>
        </div>
        <div
          style={{ mask: "url('/img/bg-tile.svg')" }}
          className="h-full w-full bg-secondary-500 absolute top-0 -z-10 opacity-30"
        />
      </form>
      <InvalidMessageDialog error={validationError} setError={setValidationError} />
    </>
  );
};