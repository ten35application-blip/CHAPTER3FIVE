/**
 * Random name pool for the "Surprise me" button on onboarding.
 *
 * Mix of English, Spanish, and other origins; mix of warm-older and
 * modern vibes; mix of genders. Pool is intentionally diverse so the
 * suggested name doesn't lock the persona into one demographic.
 *
 * Currently: 355 names. Add more freely; the random pick scales.
 */

export const names: string[] = [
  // English — warm older / classic
  "Marian", "Eleanor", "Frances", "Dorothy", "Margaret", "Ruth", "Helen", "Beatrice",
  "Florence", "Vivian", "Edith", "Gladys", "Mildred", "Hazel", "Pearl", "Iris",
  "Agnes", "Ethel", "Opal", "Constance", "Estelle", "June", "Audrey", "Lillian",
  "Walter", "Harold", "Stanley", "Clarence", "Arthur", "Edmund", "Gerald", "Frederick",
  "Norman", "Eugene", "Leonard", "Lawrence", "Reginald", "Howard", "Clifford", "Sidney",
  "Wilbur", "Otis", "Earl", "Ralph", "Vernon", "Lloyd", "Roy",

  // English — middle-aged practical
  "Linda", "Susan", "Karen", "Janet", "Patricia", "Deborah", "Cindy", "Cheryl",
  "Donna", "Sharon", "Brenda", "Pamela", "Lori", "Tammy", "Wendy", "Kim",
  "Mike", "Steve", "Dave", "Tim", "Greg", "Doug", "Brad", "Kevin",
  "Chuck", "Rick", "Tom", "Bob", "Phil", "Ken", "Ron", "Jeff",
  "Gary", "Larry", "Barry", "Wayne", "Dale", "Glenn", "Curtis",

  // English — modern younger
  "Avery", "Riley", "Jordan", "Morgan", "Quinn", "Sage", "Rowan", "Emerson",
  "Hayden", "Kai", "Phoenix", "Reese", "Skyler", "Wren", "Ash", "Blair",
  "Drew", "Eli", "Finn", "Gray", "Hollis", "Indigo", "Jules", "Lane",
  "Milo", "Nico", "Oak", "Parker", "Remy", "Sloane", "Theo", "Uriel",
  "Vesper", "Wells", "Xander", "Yael", "Zane",

  // Spanish — traditional / older
  "Marisol", "Carmen", "Lourdes", "Concepción", "Mercedes", "Consuelo", "Pilar", "Esperanza",
  "Amparo", "Soledad", "Dolores", "Asunción", "Rosario", "Encarnación", "Remedios", "Milagros",
  "Inmaculada", "Angustias", "Begoña", "Covadonga",
  "José", "Francisco", "Antonio", "Manuel", "Juan", "Pedro", "Miguel", "Ramón",
  "Jesús", "Andrés", "Joaquín", "Salvador", "Eduardo", "Rafael", "Ricardo", "Alfonso",
  "Vicente", "Ignacio", "Roberto", "Eusebio", "Cipriano",

  // Spanish — modern
  "Sofía", "Valentina", "Camila", "Isabella", "Lucía", "Martina", "Paula", "Daniela",
  "Andrea", "Renata", "Emilia", "Mía", "Antonella", "Catalina", "Julia", "Regina",
  "Mateo", "Santiago", "Lucas", "Sebastián", "Diego", "Nicolás", "Tomás", "Emiliano",
  "Maximiliano", "Bruno", "León", "Joaquín", "Pablo", "Gael", "Iker", "Damián",

  // Latin / mixed first names common across regions
  "Rosa", "Luz", "Alma", "Estrella", "Paloma", "Aurora", "Marina", "Celeste",
  "Luna", "Mar", "Cielo", "Olivia", "Violeta", "Rocío", "Azucena", "Magnolia",
  "Hugo", "Álvaro", "Óscar", "César", "Adrián", "Ángel", "Cristian", "Iván",

  // Diminutive/nickname feel
  "Lola", "Pepa", "Cuca", "Mami", "Tati", "Tita", "Coco", "Chacha",
  "Pepe", "Paco", "Nacho", "Lalo", "Memo", "Beto", "Toño", "Chuy",
  "Bea", "Reyna", "Yola", "Vicky",

  // Eccentric / literary / unusual
  "Atticus", "Beckett", "Cyril", "Dashiell", "Eulalia", "Florian", "Geneva", "Halcyon",
  "Ignatius", "Juniper", "Killian", "Lazarus", "Marcellus", "Niamh", "Oberon", "Persephone",
  "Quill", "Rafferty", "Saoirse", "Tarquin", "Ulrich", "Vesta", "Wendell", "Xenia",
  "Yarrow", "Zinnia", "Bram", "Cosima", "Dorian", "Elspeth", "Fionn", "Gideon",

  // Italian / Portuguese / French (sprinkled — not exhaustive)
  "Giulia", "Chiara", "Sofia", "Beatrice", "Matilde", "Caterina", "Aurora", "Greta",
  "Lorenzo", "Leonardo", "Giovanni", "Stefano", "Marco", "Francesco", "Alessandro", "Davide",
  "Inês", "Mariana", "Beatriz", "Joana", "Helena", "Madalena",
  "João", "Tiago", "Rui", "Pedro", "Bruno", "Diogo",
  "Camille", "Margaux", "Anaïs", "Élodie", "Solène", "Amélie",
  "Étienne", "Loïc", "Théo", "Augustin", "Clément",

  // Asian heritage (single-given common in US/UK/CA contexts)
  "Yuki", "Hiroshi", "Akiko", "Kenji", "Sora", "Haruki", "Mei", "Aiko",
  "Min-jun", "Soo-jin", "Hye-jin", "Ji-ho", "Eun", "Ha-eun",
  "Wei", "Xiu", "Liang", "Mei-Ling", "An",
  "Aarav", "Arjun", "Priya", "Rohan", "Anaya", "Veer",

  // Single-syllable / soft / poetic
  "Bell", "Birch", "Briar", "Cove", "Dove", "Echo", "Fern", "Grove",
  "Holly", "Iris", "Joy", "Lark", "Linden", "Maple", "Mira", "Pine",
  "Reed", "Sage", "Sky", "Sloane", "Sparrow", "Star", "Storm", "Sunny",
  "Thorne", "Tide", "Wren", "Yew",

  // — Additional names —

  // More English warm older
  "Beverly", "Doris", "Maxine", "Geraldine", "Bernice", "Rosalind", "Adele", "Vera",
  "Esther", "Naomi", "Lorraine", "Phyllis", "Sylvia", "Cora", "Imogene",
  "Albert", "Floyd", "Russell", "Marvin", "Herbert", "Wallace", "Harvey", "Milton",
  "Norbert", "Cecil", "Theodore",

  // More Spanish — modern
  "Aitana", "Ainhoa", "Cayetana", "Mar", "Mafalda", "Jimena", "Macarena", "Triana",
  "Bruna", "Olalla", "Vega", "Romina", "Salma",
  "Liam", "Thiago", "Dante", "Bautista", "Benjamín", "Felipe", "Cristóbal", "Aarón",
  "Iván",

  // More Spanish — older
  "Eulalia", "Pura", "Fátima", "Trinidad", "Visitación", "Práxedes", "Guadalupe",
  "Amaranta", "Eulogia",
  "Casimiro", "Hilario", "Anacleto", "Eustaquio", "Telmo",

  // More modern unisex / younger
  "Briar", "Cove", "Dakota", "Eden", "Ezra", "Florence", "Garnet", "Halcyon",
  "Indigo", "Jasper", "Kit", "Linnea", "Mar", "Noor", "Onyx", "Poet",
  "Quincy", "Rey", "Story", "Tatum", "Valor", "Wilder",

  // Italian / Greek / continental sprinkles
  "Esme", "Fia", "Lia", "Nora", "Ottavia", "Selene", "Saskia", "Ariadne",
  "Calliope", "Persephone",
  "Basilio", "Donato", "Emiliano", "Gaspare", "Lorenzo", "Mauro", "Salvo", "Ulisse",

  // Asian heritage additions
  "Mira", "Saanvi", "Diya", "Aanya", "Zara", "Anika",
  "Aryan", "Vihaan", "Reyansh", "Atharv",
  "Bao", "Linh", "Quynh", "Tran",
  "Jin", "Bae", "Hae", "Min",

  // Names that lean tender / quiet / wise
  "Else", "Eve", "Faye", "Hope", "Ivy", "Pearl", "Posy", "Rue",
  "True", "Vesna", "Zara",
];
