/**
 * Towns and trading centres by county, for the residential-address pickers.
 *
 * These are the towns a student is most likely to live in. Where a county also has a
 * sub-county breakdown in `kenya-locations.ts`, that more detailed list wins; everywhere
 * else the county list is offered. "Other (specify below)" in the form covers any town
 * that is not on the list, so the address can always be recorded.
 */
export const TOWNS_BY_COUNTY: Record<string, string[]> = {
  Baringo: [
    "Kabarnet", "Baringo", "Kabartonjo", "Marigat", "Eldama Ravine", "Mogotio",
    "Nginyang", "Tenges", "Mochongoi", "Salabani", "Kamnarok", "Kokwa", "Eburru", "Solio",
    "Kaptuya", "Kolaba",
  ],
  Bomet: [
    "Bomet", "Longisa", "Sotik", "Mulot", "Chepalungu", "Konoin", "Merigi", "Singorwet",
    "Kapchesar", "Kapkimolwa", "Chebunyo", "Kembu", "Kapletundo", "Ndanai", "Mogogosiek",
  ],
  Bungoma: [
    "Bungoma", "Webuye", "Kanduyi", "Kimilili", "Bumula", "Kabuchai", "Sirisia", "Tongaren",
    "Malakisi", "Chitenge", "Kimaet", "Nalonde", "Misikhu", "Mukuyuni", "Mwibele", "Namwela",
  ],
  Busia: [
    "Busia", "Malaba", "Funyula", "Butula", "Budalangi", "Nambale", "Port Victoria", "Amukura",
    "Bumala", "Mateka", "Lwanya", "Mungatsi", "Burumba", "Chakol", "Kokori",
  ],
  "Elgeyo-Marakwet": [
    "Iten", "Kapsowar", "Kaptagat", "Tamboo", "Chebiemit", "Arror", "Kessup", "Tot", "Kapsircheni",
  ],
  Embu: [
    "Embu", "Runyenjes", "Siakago", "Ishiara", "Kiritiri", "Manyatta", "Mavuria", "Gatumbi",
  ],
  Garissa: [
    "Garissa", "Dadaab", "Fafi", "Ijara", "Hulugho", "Lagdera", "Balambala", "Modogashe", "Masalani",
  ],
  "Homa Bay": [
    "Homa Bay", "Oyugis", "Kendu Bay", "Mbita", "Ndhiwa", "Rangwe", "Kabondo", "Karachwonyo",
    "Kasipul", "Rudi", "Suba",
  ],
  Isiolo: ["Isiolo", "Garba Tula", "Merit", "Bulesa", "Kinna", "Chabi", "Mado Gashi"],
  Kajiado: [
    "Kajiado", "Kitengela", "Ngong", "Ongata Rongai", "Isinya", "Loitokitok", "Mashuuru",
    "Namelok", "Ilbissil",
  ],
  Kakamega: [
    "Kakamega", "Mumias", "Butere", "Khwisero", "Lugari", "Lukuyani", "Navakholo", "Matete",
    "Malava", "Muturu", "Iguhu", "Kilingili", "Mabale",
  ],
  Kericho: [
    "Kericho", "Litein", "Kipkelion", "Sigowet", "Soin", "Ainamoi", "Belgut", "Kapkatet", "Tendenet",
  ],
  Kiambu: [
    "Kiambu", "Thika", "Ruiru", "Juja", "Kikuyu", "Limuru", "Gatundu", "Githunguri", "Kabete",
    "Kiambaa", "Lari", "Ndumberi", "Ting'ang'a",
  ],
  Kilifi: [
    "Kilifi", "Malindi", "Kaloleni", "Rabai", "Mariakani", "Watamu", "Mtwapa", "Ganze", "Magarini",
  ],
  Kirinyaga: [
    "Kerugoya", "Kutus", "Wanguru", "Mwea", "Sagana", "Baricho", "Kianyaga", "Pundo",
  ],
  Kisumu: [
    "Kisumu", "Maseno", "Muhoroni", "Ahero", "Nyando", "Nyakach", "Seme", "Kajulu", "Kibos",
    "Kondele", "Obunga",
  ],
  Kitui: [
    "Kitui", "Mwingi", "Mutomo", "Ikutha", "Tseikuru", "Kisasi", "Katulani", "Migwani", "Mutito",
    "Nzambani", "Kyuso", "Matiyani",
  ],
  Kwale: ["Kwale", "Ukunda", "Diani", "Msambweni", "Lunga Lunga", "Kinango", "Matuga", "Ramisi"],
  Laikipia: [
    "Nanyuki", "Rumuruti", "Nyahururu", "Doldol", "Kimanjo", "Mutara", "Naro Moru",
  ],
  Lamu: ["Lamu", "Mokowe", "Witu", "Hindi", "Shela", "Faza", "Kiunga"],
  Machakos: [
    "Machakos", "Athi River", "Kangundo", "Tala", "Masinga", "Mwala", "Yatta", "Kathiani",
  ],
  Makueni: [
    "Wote", "Makueni", "Kibwezi", "Mtito Andei", "Emali", "Mbooni", "Kilome", "Kaiti",
    "Kikumbulyu",
  ],
  Mandera: ["Mandera", "Rhamu", "Takaba", "Banissa", "Lafey", "Elwak", "Arabia"],
  Marsabit: ["Marsabit", "Moyale", "Laisamis", "North Horr", "Sololo", "Saku", "Maikona"],
  Meru: [
    "Meru", "Nkubu", "Maua", "Tigania", "Timau", "Igoji", "Mikumbune", "Kianjai",
  ],
  Migori: [
    "Migori", "Awendo", "Rongo", "Suna", "Kehancha", "Ntimaru", "Uriri", "Mabera", "Isibania",
    "Muhuru Bay",
  ],
  Mombasa: [
    "Mombasa", "Mvita", "Nyali", "Kisauni", "Likoni", "Changamwe", "Jomvu", "Bamburi",
    "Kilindini", "Miritini",
  ],
  "Murang'a": [
    "Murang'a", "Maragua", "Kenol", "Makuyu", "Kigumo", "Kangema", "Kandara", "Gatanga", "Kahuro",
    "Mathioya",
  ],
  Nairobi: [
    "Nairobi", "Westlands", "Kilimani", "Kasarani", "Roysambu", "Ruaraka", "Embakasi",
    "Kamukunji", "Makadara", "Mathare", "Kibra", "Langata", "Dagoretti", "Parklands", "Eastleigh",
  ],
  Nakuru: [
    "Nakuru", "Naivasha", "Molo", "Njoro", "Gilgil", "Bahati", "Rongai", "Subukia", "Kuresoi",
    "Elburgon", "Lanet",
  ],
  Nandi: [
    "Kapsabet", "Nandi Hills", "Mosop", "Aldai", "Chesumei", "Emgwen", "Tindiret", "Kaptumo",
  ],
  Narok: ["Narok", "Kilgoris", "Lolgorien", "Sasamua", "Olokurto", "Mara"],
  Nyamira: ["Nyamira", "Keroka", "Manga", "Ekerenyo", "Borabu", "Magomo", "Nyansiongo"],
  Nyandarua: [
    "Ol Kalou", "Nyahururu", "Engineer", "Ndaragwa", "Kipipiri", "Ol Joro Orok", "Kinangop",
    "Magomano",
  ],
  Nyeri: [
    "Nyeri", "Karatina", "Othaya", "Kiganjo", "Mweiga", "Mukurwe-ini", "Mathira", "Tetu", "Kieni",
  ],
  Samburu: ["Maralal", "Baragoi", "Wamba", "Archers Post", "Kisima"],
  Siaya: ["Siaya", "Bondo", "Ugunja", "Alego", "Gem", "Rarieda", "Ugenya", "Madiany"],
  "Taita-Taveta": ["Voi", "Wundanyi", "Mwatate", "Taveta", "Mwashoti"],
  "Tana River": ["Hola", "Garsen", "Galole", "Bura", "Kipini", "Madogo", "Wenje"],
  "Tharaka-Nithi": ["Chuka", "Marimanti", "Kithino", "Tunyai", "Nithi", "Gatunga", "Maara"],
  "Trans-Nzoia": [
    "Kitale", "Endebess", "Kiminini", "Kwanza", "Saboti", "Cherangany", "Moi's Bridge",
  ],
  Turkana: [
    "Lodwar", "Kakuma", "Lokichogio", "Kalokol", "Lokitaung", "Kainuk", "Eliye Springs",
  ],
  "Uasin Gishu": [
    "Eldoret", "Kapseret", "Kesses", "Moiben", "Soy", "Turbo", "Ainabkoi", "Langas",
  ],
  Vihiga: ["Vihiga", "Mbale", "Luanda", "Hamisi", "Sabatia", "Emuhaya", "Majengo"],
  Wajir: ["Wajir", "Eldas", "Tarbaj", "Buna", "Habaswein", "Griftu", "Dif", "Wajir Boru"],
  "West Pokot": [
    "Kapenguria", "Makutano", "Kacheliba", "Ortum", "Sigor", "Chepareria", "Alale",
  ],
};
