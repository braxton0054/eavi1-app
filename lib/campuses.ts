export type Campus = {
  name: string;
  place: string;
  phone: string;
  tel: string;
  note?: string;
  altPhone?: { phone: string; tel: string };
};

export const campuses: Campus[] = [
  {
    name: "Main Campus",
    place: "City Plaza, next to Bandaptai Hotel",
    phone: "+254 726 044 022",
    tel: "+254726044022",
    note: "Also on WhatsApp",
  },
  {
    name: "West Campus",
    place: "Mailinne, next to Kapyemit Dispensary",
    phone: "+254 748 022 044",
    tel: "+254748022044",
  },
  {
    name: "Town Office",
    place: "Skymart Building, 1st Floor, Room F45, next to Raiya Supermarket",
    phone: "+254 726 044 022",
    tel: "+254726044022",
    altPhone: { phone: "+254 722 394 443", tel: "+254722394443" },
  },
];

export type PhoneEntry = { phone: string; tel: string; campuses: string[] };

/** Main Campus and the Town Office share a number, so the contact block groups by it. */
export const phoneDirectory: PhoneEntry[] = campuses.reduce<PhoneEntry[]>(
  (entries, campus) => {
    for (const number of [
      { phone: campus.phone, tel: campus.tel },
      ...(campus.altPhone ? [campus.altPhone] : []),
    ]) {
      const existing = entries.find((e) => e.tel === number.tel);
      if (existing) existing.campuses.push(campus.name);
      else
        entries.push({
          ...number,
          campuses: [campus.name],
        });
    }
    return entries;
  },
  [],
);
