/** Shared card lifecycle rules for the student portal and the public verifier. */
export type CardStatusLike = {
  status: string;
  issuedAt: Date | null;
  expiresAt: Date | null;
};

export type CardLifecycle = {
  key: "active" | "pending" | "printing" | "lost" | "replaced" | "not-enrolled" | "expired";
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
  title: string;
  message: string;
  canVerify: boolean;
  canDownload: boolean;
  canShare: boolean;
};

const copy: Record<CardLifecycle["key"], Pick<CardLifecycle, "label" | "tone" | "title" | "message">> = {
  active: {
    label: "Active",
    tone: "success",
    title: "Your card is active",
    message: "It can be verified online and used as your official campus identity.",
  },
  pending: {
    label: "Pending",
    tone: "warning",
    title: "Your card is being prepared",
    message: "Cards are issued automatically at enrolment. If this stays pending, contact the registry.",
  },
  printing: {
    label: "Printing",
    tone: "warning",
    title: "Your card is being prepared",
    message: "The registry is preparing your card. Sharing and downloads will be available when it is issued.",
  },
  lost: {
    label: "Lost",
    tone: "danger",
    title: "This card was reported lost",
    message: "It must not be used. Contact the registry to request a replacement.",
  },
  replaced: {
    label: "Replaced",
    tone: "danger",
    title: "This card was replaced",
    message: "It is no longer active. Use your current card or contact the registry for help.",
  },
  "not-enrolled": {
    label: "Not active",
    tone: "danger",
    title: "Your enrolment is not active",
    message: "This card cannot verify as current until an active enrolment is restored.",
  },
  expired: {
    label: "Expired",
    tone: "neutral",
    title: "This card has expired",
    message: "It remains available for your records, but it is no longer proof of current enrolment.",
  },
};

/** A card is only active when it is issued, the student is enrolled, and it has not expired. */
export function cardLifecycle(
  card: CardStatusLike,
  activelyEnrolled: boolean,
  now: Date = new Date(),
): CardLifecycle {
  let key: CardLifecycle["key"];
  if (card.status === "LOST") key = "lost";
  else if (card.status === "REPLACED") key = "replaced";
  else if (card.status === "PENDING") key = "pending";
  else if (card.status === "PRINTING") key = "printing";
  else if (card.status !== "ISSUED" || card.issuedAt === null) key = "pending";
  else if (!activelyEnrolled) key = "not-enrolled";
  else if (card.expiresAt !== null && card.expiresAt < now) key = "expired";
  else key = "active";

  const issued = card.status === "ISSUED" && card.issuedAt !== null;
  return {
    key,
    ...copy[key],
    canVerify: issued,
    canDownload: issued,
    canShare: key === "active",
  };
}
