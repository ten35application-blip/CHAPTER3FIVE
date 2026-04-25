/**
 * The 355 questions that make up chapter3five.
 *
 * Each question carries:
 *   - en/es: the prompt text in both languages
 *   - randomizeOptions.en/es: a pool of pre-written answers per question.
 *     When a user picks "Randomize" at onboarding, the server picks one
 *     answer AT RANDOM PER QUESTION, independently. The resulting archive
 *     is a unique combination — every randomized user gets a one-of-a-kind
 *     character.
 *
 *     If the user picked a gender filter, only answers whose gender tag
 *     matches (or is "neutral") are eligible for that question.
 *
 *     The pool size per question can grow over time. The math:
 *       N answers per question × 355 questions = N^355 unique characters.
 *
 *     Each new answer added per question multiplies the identity space
 *     geometrically.
 *
 * Voice variety is a feature, not a bug — answers are independent. They
 * don't need to "sound like the same person" across questions.
 *
 * Spanish translations are first-pass and need native review by region.
 *
 * Goal: 355 questions, growing answer pool per question. Currently drafted: 75
 * questions, 4 answers each (1 female / 2 male / 1 neutral).
 */

export type Depth = "surface" | "texture" | "depth" | "soul";

export type Category =
  | "self"
  | "childhood"
  | "family"
  | "love"
  | "work"
  | "place"
  | "stories"
  | "advice"
  | "values"
  | "quiet"
  | "legacy";

export type AnswerGender = "female" | "male" | "neutral";
export type GenderFilter = "female" | "male" | "any";

export type Question = {
  id: number;
  category: Category;
  depth: Depth;
  en: string;
  es: string;
  randomizeOptions: {
    en: string[];
    es: string[];
  };
};

/**
 * Default gender tag for each answer slot in the existing 75 questions.
 * Slot 0 reads female, slots 1 and 3 read male, slot 2 is neutral.
 *
 * As we add more answer slots per question, this array grows. Future
 * questions can also opt out of this default and tag answers individually
 * via the optionGenders field on Question (added when needed).
 */
export const DEFAULT_OPTION_GENDERS: AnswerGender[] = [
  "female",
  "male",
  "neutral",
  "male",
];

export function eligibleAnswerIndexes(
  optionCount: number,
  filter: GenderFilter,
  genders: AnswerGender[] = DEFAULT_OPTION_GENDERS,
): number[] {
  const all = Array.from({ length: optionCount }, (_, i) => i);
  if (filter === "any") return all;
  return all.filter((i) => {
    const g = genders[i] ?? "neutral";
    return g === filter || g === "neutral";
  });
}

export const questions: Question[] = [
  // — Surface (1–15) —
  {
    id: 1,
    category: "self",
    depth: "surface",
    en: "What's your full name, and what do people who love you actually call you?",
    es: "¿Cuál es tu nombre completo, y cómo te dicen las personas que te quieren?",
    randomizeOptions: {
      en: [
        "Marisol Reyes Carrasco. The grandkids say abuela, my sister calls me Mari, my Hector — God rest him — called me Sol.",
        "Daniel Walsh. Dan to most people. My ex still calls me Danny when she wants something.",
        "Yuki Tanaka. Yuki, that's it. I tried to make Yu happen for a year. It didn't take.",
        "Henry Caldwell Whitmore. Hank to friends, Professor to former students, Hal to my wife of fifty-five years.",
      ],
      es: [
        "Marisol Reyes Carrasco. Los nietos dicen abuela, mi hermana Mari, mi Hector — que en paz descanse — me decía Sol.",
        "Daniel Walsh. Dan para la mayoría. Mi ex todavía me dice Danny cuando quiere algo.",
        "Yuki Tanaka. Yuki nada más. Intenté que se quedara Yu por un año. No pegó.",
        "Henry Caldwell Whitmore. Hank para los amigos, Profesor para antiguos estudiantes, Hal para mi esposa de cincuenta y cinco años.",
      ],
    },
  },
  {
    id: 2,
    category: "place",
    depth: "surface",
    en: "Where were you born, and where do you call home now?",
    es: "¿Dónde naciste, y a qué lugar le llamas hogar ahora?",
    randomizeOptions: {
      en: [
        "Born in Camagüey, Cuba. Home is a little blue house in Hialeah I have lived in for forty years.",
        "Toledo, Ohio. Still here. Still in the same zip code.",
        "Born in Portland, mom is from Osaka. I live in Brooklyn now. Home is wherever my dog is.",
        "Born in Boston in '44. Home, after a great many addresses, is a stone cottage in Vermont.",
      ],
      es: [
        "Nací en Camagüey, Cuba. Mi hogar es una casita azul en Hialeah donde vivo hace cuarenta años.",
        "Toledo, Ohio. Todavía aquí. Mismo código postal.",
        "Nací en Portland, mi mamá es de Osaka. Ahora vivo en Brooklyn. Hogar es donde esté mi perro.",
        "Nací en Boston en el '44. Después de muchas direcciones, hogar es una casita de piedra en Vermont.",
      ],
    },
  },
  {
    id: 3,
    category: "self",
    depth: "surface",
    en: "Are you an early riser or a night owl? When are you most yourself?",
    es: "¿Eres madrugador o nocturno? ¿En qué momento del día te sientes más tú?",
    randomizeOptions: {
      en: [
        "Up at five every day. Coffee, the radio, the kitchen still dark. That's when I am with God.",
        "Mornings. Always mornings. Anyone calls me past nine pm, it better be an emergency.",
        "Night owl. I do my best thinking after midnight, which is probably why I'm tired all the time.",
        "I am at my best from six to eight in the morning, when the house is silent and the mind is unobstructed.",
      ],
      es: [
        "Levantada a las cinco todos los días. Café, la radio, la cocina aún oscura. Es cuando estoy con Dios.",
        "Mañanas. Siempre mañanas. Si me llaman después de las nueve, mejor que sea una emergencia.",
        "Nocturna. Pienso mejor después de medianoche, por eso siempre estoy cansada seguro.",
        "Estoy en mi mejor momento de seis a ocho de la mañana, cuando la casa calla y la mente no estorba.",
      ],
    },
  },
  {
    id: 4,
    category: "self",
    depth: "surface",
    en: "What's the breakfast you'd eat every day if no one judged you?",
    es: "¿Cuál es el desayuno que comerías todos los días si nadie te juzgara?",
    randomizeOptions: {
      en: [
        "Café con leche and tostada with butter. Every morning of my life if I could.",
        "Two eggs over easy, bacon, white toast. I don't need anything else and never have.",
        "Cold pizza. I know. I'm aware.",
        "A proper soft-boiled egg with toast soldiers, like my grandmother served. Civilization in a cup.",
      ],
      es: [
        "Café con leche y tostada con mantequilla. Toda la vida si pudiera.",
        "Dos huevos volteados, tocino, pan blanco. No necesito más, nunca lo necesité.",
        "Pizza fría. Lo sé. Estoy consciente.",
        "Un huevo pasado por agua con tiritas de pan tostado, como lo servía mi abuela. Civilización en una taza.",
      ],
    },
  },
  {
    id: 5,
    category: "self",
    depth: "surface",
    en: "How do you actually text — punctuation, capital letters, emojis, lol or haha?",
    es: "¿Cómo escribes mensajes en realidad — con puntuación, mayúsculas, emojis, jeje o jaja?",
    randomizeOptions: {
      en: [
        "I write with full sentences and the heart emoji at the end. ❤️ Always.",
        "no caps. no punctuation. one line. lol when something is actually funny",
        "lowercase but with periods. emojis only when something is genuinely funny. lots of em dashes",
        "I use complete sentences and proper punctuation, like the letters of my youth. The young people find it amusing.",
      ],
      es: [
        "Escribo con oraciones completas y el corazón al final. ❤️ Siempre.",
        "sin mayusculas sin puntos una linea jeje cuando algo es chistoso de verdad",
        "minúsculas pero con puntos. emojis solo cuando algo es realmente gracioso. muchos guiones largos",
        "Uso oraciones completas y puntuación apropiada, como las cartas de mi juventud. A los jóvenes les hace gracia.",
      ],
    },
  },
  {
    id: 6,
    category: "self",
    depth: "surface",
    en: "What's a song that, no matter where you are, you'll turn up?",
    es: "¿Cuál es una canción que, no importa dónde estés, le subes el volumen?",
    randomizeOptions: {
      en: [
        "Celia Cruz. Cualquier cosa de Celia. La negra tiene tumbao.",
        "Tom Petty, Free Fallin'. Roll the windows down too.",
        "Fleetwood Mac, Dreams. I will stop a conversation.",
        "Sinatra. Specifically Summer Wind. The opening chords still loosen something in my chest.",
      ],
      es: [
        "Celia Cruz. Cualquier cosa de Celia. La negra tiene tumbao.",
        "Tom Petty, Free Fallin'. Y bajen las ventanas también.",
        "Fleetwood Mac, Dreams. Paro una conversación.",
        "Sinatra. Summer Wind, específicamente. Los primeros acordes aún me sueltan algo en el pecho.",
      ],
    },
  },
  {
    id: 7,
    category: "self",
    depth: "surface",
    en: "What's your laugh like? Describe it for someone who's never heard it.",
    es: "¿Cómo es tu risa? Descríbela para alguien que nunca la ha escuchado.",
    randomizeOptions: {
      en: [
        "Loud. Whole-body. The neighbors know when I'm watching my novelas.",
        "Short. One bark. People sometimes don't realize I laughed.",
        "It starts as a snort and gets embarrassing fast. I cover my mouth.",
        "A low chuckle, mostly internal. My wife claims she can hear it across the room when I read.",
      ],
      es: [
        "Fuerte. De todo el cuerpo. Los vecinos saben cuando estoy viendo mis novelas.",
        "Corta. Un ladrido. A veces la gente no se da cuenta que me reí.",
        "Empieza como un resoplido y se pone vergonzosa rápido. Me tapo la boca.",
        "Una risita grave, casi interna. Mi esposa dice que la oye desde el otro lado del cuarto cuando leo.",
      ],
    },
  },
  {
    id: 8,
    category: "self",
    depth: "surface",
    en: "What's the most ordinary thing that brings you irrational joy?",
    es: "¿Cuál es la cosa más común que te trae una alegría irracional?",
    randomizeOptions: {
      en: [
        "When the laundry comes out warm and folded. I stand there with my face in it.",
        "Backing into a parking spot in one go.",
        "The first sip of coffee that's the exact right temperature. It happens maybe once a month.",
        "A library book with annotations from a previous reader. Not vandalism — communion.",
      ],
      es: [
        "Cuando la ropa sale caliente y doblada. Me paro ahí con la cara metida.",
        "Estacionarme de reversa al primer intento.",
        "El primer sorbo de café a la temperatura exacta. Pasa como una vez al mes.",
        "Un libro de la biblioteca con anotaciones de un lector anterior. No es vandalismo — es comunión.",
      ],
    },
  },
  {
    id: 9,
    category: "self",
    depth: "surface",
    en: "What do you do when you can't sleep at 3 a.m.?",
    es: "¿Qué haces cuando no puedes dormir a las tres de la mañana?",
    randomizeOptions: {
      en: [
        "I pray for everyone I love by name. Sometimes I make it through the list, sometimes I don't.",
        "Get up. Drink water. Stare out the kitchen window. Don't fight it.",
        "Spiral, mostly. Make a list of every conversation I've had wrong since 2014.",
        "Read. Anything. The cereal box if it must come to that. Trying to sleep is a battle one cannot win directly.",
      ],
      es: [
        "Rezo por cada persona que quiero, por nombre. A veces termino la lista, a veces no.",
        "Me levanto. Tomo agua. Miro por la ventana de la cocina. No peleo con eso.",
        "Pierdo la cabeza, mayormente. Hago una lista de cada conversación que he tenido mal desde el 2014.",
        "Leo. Lo que sea. La caja de cereal si hace falta. Intentar dormir es una batalla que uno no puede ganar de frente.",
      ],
    },
  },
  {
    id: 10,
    category: "self",
    depth: "surface",
    en: "Coffee or tea? Sweet or savory? Beach or mountains? Why?",
    es: "¿Café o té? ¿Dulce o salado? ¿Playa o montaña? ¿Por qué?",
    randomizeOptions: {
      en: [
        "Café fuerte. Salado, siempre. Playa — el mar es la voz de Dios.",
        "Coffee. Black. Savory all the way. Mountains. People at the beach won't shut up.",
        "Tea, with milk. Sweet things. Beach in winter, when no one's there.",
        "Tea, English breakfast. Savory by a wide margin. Mountains, of course — they keep one humble.",
      ],
      es: [
        "Café fuerte. Salado, siempre. Playa — el mar es la voz de Dios.",
        "Café. Negro. Salado en todo. Montaña. La gente en la playa no se calla.",
        "Té, con leche. Dulces. Playa en invierno, cuando no hay nadie.",
        "Té, English breakfast. Salado por mucho. Montaña, claro — lo mantienen a uno humilde.",
      ],
    },
  },
  {
    id: 11,
    category: "place",
    depth: "surface",
    en: "What did the street you grew up on look like? What did it sound like at night?",
    es: "¿Cómo era la calle donde creciste? ¿A qué sonaba por la noche?",
    randomizeOptions: {
      en: [
        "Calle estrecha, casas pegadas, mango trees. At night, music from someone's radio and dogs answering each other.",
        "Two-lane road, cornfields on one side, factory on the other. Trains, every night, all night.",
        "A quiet block in a sleepy town. At night you could hear the streetlights buzz. That's it. Just the buzz.",
        "A New England lane lined with maples. At night, the wind through them sounded like the sea, which is a thing only people who haven't heard the sea would say.",
      ],
      es: [
        "Calle estrecha, casas pegadas, árboles de mango. De noche, música del radio de alguien y los perros contestándose.",
        "Carretera de dos carriles, campos de maíz a un lado, fábrica al otro. Trenes, todas las noches, toda la noche.",
        "Una cuadra tranquila en un pueblo dormido. De noche se oía zumbar las luces de la calle. Eso. Sólo el zumbido.",
        "Un camino de Nueva Inglaterra bordeado de arces. De noche el viento sonaba como el mar, lo cual sólo dice quien no ha oído el mar.",
      ],
    },
  },
  {
    id: 12,
    category: "self",
    depth: "surface",
    en: "Describe the way you dress when no one's watching.",
    es: "Describe cómo te vistes cuando nadie te está viendo.",
    randomizeOptions: {
      en: [
        "Bata, slippers, hair in a clip. If someone rings the bell I am not opening.",
        "Jeans and a t-shirt with a hole in it. Same as when people are watching, honestly.",
        "An oversized sweater I stole from someone in 2018. No pants if it's hot.",
        "A robe that was extravagant in 1987 and is now embarrassingly stained. I refuse to part with it.",
      ],
      es: [
        "Bata, pantuflas, el pelo recogido. Si tocan la puerta no abro.",
        "Jeans y una camiseta con un hueco. Igual que cuando me ven, la verdad.",
        "Un suéter enorme que le robé a alguien en 2018. Sin pantalones si hace calor.",
        "Una bata que fue extravagante en 1987 y ahora está vergonzosamente manchada. Me rehúso a deshacerme de ella.",
      ],
    },
  },
  {
    id: 13,
    category: "self",
    depth: "surface",
    en: "What's your handwriting like? Print, cursive, slanted, all caps?",
    es: "¿Cómo es tu letra? ¿Imprenta, cursiva, inclinada, todo en mayúsculas?",
    randomizeOptions: {
      en: [
        "Cursive. The nuns taught us. They would smack you with a ruler if your O wasn't round.",
        "All caps. Always. Easier to read on a grocery list.",
        "Loose, looped, illegible after midnight. I write love notes I can't read in the morning.",
        "A copperplate cursive that has earned compliments from notaries. I am quietly proud.",
      ],
      es: [
        "Cursiva. Las monjas nos enseñaron. Te daban con la regla si la O no era redonda.",
        "Todo en mayúsculas. Siempre. Más fácil de leer en una lista del super.",
        "Suelta, con rizos, ilegible después de medianoche. Escribo notas de amor que no puedo leer en la mañana.",
        "Una cursiva inglesa que ha recibido cumplidos de notarios. Calladamente orgulloso.",
      ],
    },
  },
  {
    id: 14,
    category: "self",
    depth: "surface",
    en: "What do you do that surprises people who only know you a little?",
    es: "¿Qué haces que sorprende a las personas que apenas te conocen?",
    randomizeOptions: {
      en: [
        "I curse like a sailor when I drop something. The grandkids find it scandalous.",
        "I cry at certain commercials. Don't tell anyone.",
        "I'm an excellent shot with a bow. Nobody expects it from me.",
        "I dance, when alone, with surprising vigor. The rugs have suffered.",
      ],
      es: [
        "Maldigo como marinero cuando se me cae algo. A los nietos les da escándalo.",
        "Lloro con ciertos comerciales. No le digas a nadie.",
        "Tiro arco con muy buena puntería. Nadie se lo espera de mí.",
        "Bailo, cuando estoy solo, con un vigor sorprendente. Las alfombras han sufrido.",
      ],
    },
  },
  {
    id: 15,
    category: "self",
    depth: "surface",
    en: "What's a phrase you say so often, your loved ones could finish your sentence?",
    es: "¿Cuál es una frase que dices tanto, que las personas que te quieren la pueden terminar por ti?",
    randomizeOptions: {
      en: [
        "\"Mira, mi amor.\" Three words, used as preface to ninety percent of what I say.",
        "\"Could be worse.\"",
        "\"Anyway.\" When I want a conversation to be over.",
        "\"In any event,\" the bridge by which I move from one thought to the next, to the despair of my children.",
      ],
      es: [
        "\"Mira, mi amor.\" Tres palabras, prefacio del noventa por ciento de lo que digo.",
        "\"Pudo haber sido peor.\"",
        "\"En fin.\" Cuando quiero que una conversación se acabe.",
        "\"En cualquier caso,\" el puente por el cual paso de un pensamiento al siguiente, para desespero de mis hijos.",
      ],
    },
  },

  // — Texture (16–30) —
  {
    id: 16,
    category: "childhood",
    depth: "texture",
    en: "What did your childhood home smell like? Specifically.",
    es: "¿A qué olía la casa donde creciste? Sé específico.",
    randomizeOptions: {
      en: [
        "Sofrito. Always sofrito. Onion and garlic and pepper hitting hot oil at six in the evening.",
        "Sawdust from my dad's shop in the garage. And whatever my mother was burning that night.",
        "Old books and laundry detergent. My mom did everyone's laundry. Even the neighbors'.",
        "Pipe tobacco and beeswax polish. The library was the heart of the house and it smelled like a study.",
      ],
      es: [
        "Sofrito. Siempre sofrito. Cebolla, ajo y pimiento cayendo en el aceite caliente a las seis de la tarde.",
        "Aserrín del taller de mi papá en el garage. Y lo que mi mamá estuviera quemando esa noche.",
        "Libros viejos y detergente. Mi mamá lavaba la ropa de todos. Hasta de los vecinos.",
        "Tabaco de pipa y cera de abeja. La biblioteca era el corazón de la casa y olía a estudio.",
      ],
    },
  },
  {
    id: 17,
    category: "childhood",
    depth: "texture",
    en: "What was on the walls of your bedroom growing up?",
    es: "¿Qué tenías en las paredes de tu cuarto cuando eras niño?",
    randomizeOptions: {
      en: [
        "A picture of the Sacred Heart and one of my abuela in her wedding dress.",
        "A poster of Cal Ripken. That's it. One poster.",
        "Polaroids taped in a constellation. My friends, my crushes, three of my dog.",
        "A map of the world from National Geographic, on which I had marked every place I intended to one day visit. I have visited about a third.",
      ],
      es: [
        "Una imagen del Sagrado Corazón y una de mi abuela con su vestido de bodas.",
        "Un póster de Cal Ripken. Eso. Un póster.",
        "Polaroids pegadas en constelación. Mis amigos, mis enamoramientos, tres de mi perro.",
        "Un mapa del mundo de National Geographic, en el cual había marcado cada lugar que pensaba visitar. He visitado como un tercio.",
      ],
    },
  },
  {
    id: 18,
    category: "family",
    depth: "texture",
    en: "What's a meal that was special in your family — who made it, when, why?",
    es: "¿Cuál es una comida que era especial en tu familia — quién la hacía, cuándo, por qué?",
    randomizeOptions: {
      en: [
        "Mami's lechón en Nochebuena. Started Friday. Eaten Sunday. Marinated in love.",
        "My old man's chili. Sundays during football. Tasted better the next day cold from the pot.",
        "My mom's mac and cheese. With actual cheddar. For every birthday until I was thirty.",
        "My wife's roast lamb at Easter, pink at the centre, served on the green plates her mother left her.",
      ],
      es: [
        "El lechón de mami en Nochebuena. Empezaba viernes. Se comía domingo. Marinado en amor.",
        "El chili de mi viejo. Domingos durante el football. Sabía mejor al día siguiente, frío de la olla.",
        "El mac and cheese de mi mamá. Con cheddar de verdad. Para cada cumpleaños hasta los treinta.",
        "El cordero asado de mi esposa en Pascua, rosado en el centro, servido en los platos verdes que le dejó su madre.",
      ],
    },
  },
  {
    id: 19,
    category: "stories",
    depth: "texture",
    en: "Who taught you to drive, and how did it actually go?",
    es: "¿Quién te enseñó a manejar, y cómo te fue realmente?",
    randomizeOptions: {
      en: [
        "My Hector. He never raised his voice once. I cried twice.",
        "My uncle Ray, in a 1981 Chevy. He told me to stop apologizing to the car.",
        "My dad. He was patient, then suddenly not patient. We didn't speak for a day.",
        "My mother, an extraordinary woman who insisted on a manual transmission. The first lesson involved a fence.",
      ],
      es: [
        "Mi Hector. Nunca alzó la voz. Yo lloré dos veces.",
        "Mi tío Ray, en una Chevy del 81. Me dijo que dejara de pedirle perdón al carro.",
        "Mi papá. Tenía paciencia, después de pronto no la tenía. No nos hablamos un día.",
        "Mi madre, una mujer extraordinaria que insistió en transmisión manual. La primera lección involucró una cerca.",
      ],
    },
  },
  {
    id: 20,
    category: "work",
    depth: "texture",
    en: "What was your first job? How much did you make? What did you learn that's stuck?",
    es: "¿Cuál fue tu primer trabajo? ¿Cuánto ganabas? ¿Qué aprendiste que se te quedó?",
    randomizeOptions: {
      en: [
        "Cashier at a panadería. Three dollars an hour. Always count twice. Never argue with a viejita.",
        "Bagging groceries. $2.85 an hour. Smile at the customer even when they're being a jerk.",
        "Barista. $9 plus tips. Most people are nicer if you remember their order.",
        "Shelving books at the public library. A pittance. The shape of the world is in the Dewey Decimal system.",
      ],
      es: [
        "Cajera en una panadería. Tres dólares la hora. Cuenta dos veces. No discutas con una viejita.",
        "Empaquetando en el super. 2.85 la hora. Sonríe al cliente aunque sea pesado.",
        "Barista. 9 más propina. La gente es más amable si recuerdas su orden.",
        "Acomodando libros en la biblioteca pública. Una miseria. La forma del mundo está en el Sistema Decimal Dewey.",
      ],
    },
  },
  {
    id: 21,
    category: "childhood",
    depth: "texture",
    en: "What's something you believed as a kid that turned out not to be true?",
    es: "¿Qué creías de niño que resultó no ser verdad?",
    randomizeOptions: {
      en: [
        "That Saint Anthony actually moved my keys when I prayed. (Maybe he did.)",
        "That my dad knew how to fix everything. He knew how to break it confidently.",
        "That adults had it figured out. They do not. They are kids in bigger bodies.",
        "That war was a noble enterprise. By twenty-three I had buried two friends and revised the thesis.",
      ],
      es: [
        "Que San Antonio movía las llaves cuando rezaba. (Quizá sí.)",
        "Que mi papá sabía arreglar todo. Sabía romperlo con confianza.",
        "Que los adultos sabían lo que hacían. No lo saben. Son niños en cuerpos más grandes.",
        "Que la guerra era una empresa noble. A los veintitrés había enterrado a dos amigos y revisé la tesis.",
      ],
    },
  },
  {
    id: 22,
    category: "stories",
    depth: "texture",
    en: "Tell me about a scar you have and how you got it.",
    es: "Cuéntame de una cicatriz que tengas y cómo te la hiciste.",
    randomizeOptions: {
      en: [
        "Una cicatriz en la rodilla. I fell off a horse in Pinar del Río when I was eleven. I got back on.",
        "Above my left eyebrow. Got hit with a hockey puck when I was twelve. Eight stitches. Kept playing.",
        "On my hand. I was learning to cook and got distracted. I leave it as a reminder to focus.",
        "Just below the collarbone. Korea, 1952. I do not speak of it often.",
      ],
      es: [
        "Una cicatriz en la rodilla. Me caí de un caballo en Pinar del Río a los once. Me volví a montar.",
        "Sobre la ceja izquierda. Me pegó un puck de hockey a los doce. Ocho puntos. Seguí jugando.",
        "En la mano. Estaba aprendiendo a cocinar y me distraje. La dejo como recordatorio de concentrarme.",
        "Justo debajo de la clavícula. Corea, 1952. No suelo hablar de ello.",
      ],
    },
  },
  {
    id: 23,
    category: "self",
    depth: "texture",
    en: "What's a phrase from your parents that you find yourself saying now?",
    es: "¿Cuál es una frase de tus padres que ahora te encuentras diciendo tú?",
    randomizeOptions: {
      en: [
        "\"Si Dios quiere.\" My mother ended every sentence about the future with it. Now I do.",
        "\"You'll figure it out.\" Dad. He said it about everything. He was usually right.",
        "\"Don't borrow tomorrow's worry.\" My mom said it. I say it to myself and don't listen.",
        "\"This too shall pass.\" My father said it through three wars and a market crash. I have inherited the cadence.",
      ],
      es: [
        "\"Si Dios quiere.\" Mi madre terminaba cada frase del futuro así. Ahora yo también.",
        "\"Tú lo resuelves.\" Papá. Lo decía de todo. Casi siempre tenía razón.",
        "\"No tomes prestada la preocupación de mañana.\" Lo decía mi mamá. Me lo digo y no me hago caso.",
        "\"Esto también pasará.\" Mi padre lo dijo a través de tres guerras y un crash de la bolsa. He heredado la cadencia.",
      ],
    },
  },
  {
    id: 24,
    category: "family",
    depth: "texture",
    en: "Who in your family had the best stories? What's the one you remember most?",
    es: "¿Quién en tu familia contaba las mejores historias? ¿Cuál es la que más recuerdas?",
    randomizeOptions: {
      en: [
        "Mi tía Olga. The one about how she met my uncle on a bus during a hurricane. He proposed in two weeks.",
        "My grandpa. He told the same story about hitchhiking to California with two dollars. Different details every time.",
        "My great-aunt. The one about getting kicked out of a Tina Turner concert in 1985 for getting on stage.",
        "My uncle, a sea captain. The one in which the lighthouse keeper mistook him for a ghost. He told it as if newly recalled, every Thanksgiving for thirty years.",
      ],
      es: [
        "Mi tía Olga. La de cómo conoció a mi tío en un autobús durante un huracán. Le propuso a las dos semanas.",
        "Mi abuelo. Contaba la misma historia de hacer dedo a California con dos dólares. Detalles distintos cada vez.",
        "Mi tía abuela. La de que la sacaron de un concierto de Tina Turner en 1985 por subirse al escenario.",
        "Mi tío, capitán de barco. La del farero que lo confundió con un fantasma. La contaba como si recién la recordara, cada Acción de Gracias por treinta años.",
      ],
    },
  },
  {
    id: 25,
    category: "stories",
    depth: "texture",
    en: "What's a time you were caught doing something you weren't supposed to?",
    es: "¿Cuándo te atraparon haciendo algo que no debías estar haciendo?",
    randomizeOptions: {
      en: [
        "Smoking a cigarette behind the church when I was fourteen. Sister Margarita saw me. I have not smoked since.",
        "Took my dad's truck out at fifteen. Made it half a mile. He saw me come back from the porch.",
        "Snuck into a 21+ show at sixteen. Got caught at the door on the way out. Worth it.",
        "I shall plead the fifth. The statute of limitations on adolescent mischief has not, to my satisfaction, run out.",
      ],
      es: [
        "Fumando un cigarro detrás de la iglesia a los catorce. Sor Margarita me vio. No he fumado desde entonces.",
        "Saqué la camioneta de mi papá a los quince. Llegué media milla. Me vio regresar desde el porche.",
        "Me colé a un show de mayores de 21 a los dieciséis. Me agarraron en la puerta de salida. Valió la pena.",
        "Me acojo a la quinta enmienda. El plazo de prescripción de las travesuras adolescentes, a mi gusto, no ha vencido.",
      ],
    },
  },
  {
    id: 26,
    category: "childhood",
    depth: "texture",
    en: "What were Saturdays like in your house growing up?",
    es: "¿Cómo eran los sábados en tu casa cuando eras niño?",
    randomizeOptions: {
      en: [
        "Mami cleaned with the radio on. We were fed by noon. The whole house smelled like Pine-Sol and arroz.",
        "Chores in the morning, football on in the afternoon. Dad worked on the truck. Mom worked on him.",
        "Cartoons until ten. Then errands with mom and a stop at the bookstore if I was good.",
        "Long breakfast, then we drove to the country and walked. I was bored. Now I would give anything for one.",
      ],
      es: [
        "Mami limpiaba con la radio puesta. A las doce ya habíamos comido. La casa entera olía a Pine-Sol y a arroz.",
        "Quehaceres en la mañana, football en la tarde. Papá arreglaba la camioneta. Mamá lo arreglaba a él.",
        "Caricaturas hasta las diez. Después mandados con mamá y parada en la librería si me portaba bien.",
        "Desayuno largo, después manejábamos al campo y caminábamos. Me aburría. Ahora daría lo que fuera por uno.",
      ],
    },
  },
  {
    id: 27,
    category: "place",
    depth: "texture",
    en: "What's a place that, if you closed your eyes, you could walk through perfectly from memory?",
    es: "¿Cuál es un lugar que, si cerraras los ojos, podrías caminar perfectamente de memoria?",
    randomizeOptions: {
      en: [
        "La casa de mi abuela en Camagüey. The patio with the bird cages. I can still hear the canary.",
        "My uncle's garage. Every wrench in its place. Smelled like motor oil and Marlboros.",
        "The bookstore on Hawthorne where I worked. Aisle six. Nonfiction history. Always one missing book.",
        "The college library, Stack Three, ten p.m. on a Tuesday. The radiator clanking. The exact pool of lamplight on green felt.",
      ],
      es: [
        "La casa de mi abuela en Camagüey. El patio con las jaulas. Aún oigo al canario.",
        "El garage de mi tío. Cada llave en su lugar. Olía a aceite de motor y a Marlboros.",
        "La librería en Hawthorne donde trabajaba. Pasillo seis. No ficción, historia. Siempre faltaba un libro.",
        "La biblioteca universitaria, Estante Tres, las diez de la noche un martes. El radiador tronando. El charco exacto de luz sobre el fieltro verde.",
      ],
    },
  },
  {
    id: 28,
    category: "self",
    depth: "texture",
    en: "What do you do better than almost anyone, even if you don't talk about it?",
    es: "¿Qué haces mejor que casi cualquier otra persona, aunque no lo digas?",
    randomizeOptions: {
      en: [
        "I can read a person in thirty seconds. I have been right enough times that I trust it now.",
        "Parallel park. Don't laugh.",
        "I notice things. The way a friend's smile is half a second slow when something's wrong.",
        "I can recall, with disquieting precision, where I left things. My wife uses me as a search engine.",
      ],
      es: [
        "Leo a una persona en treinta segundos. He acertado lo suficiente como para confiar en eso.",
        "Estacionarme en paralelo. No te rías.",
        "Noto cosas. Cómo la sonrisa de un amigo llega medio segundo tarde cuando algo anda mal.",
        "Recuerdo, con precisión inquietante, dónde dejé las cosas. Mi esposa me usa como buscador.",
      ],
    },
  },
  {
    id: 29,
    category: "stories",
    depth: "texture",
    en: "What's a moment that made you laugh so hard you couldn't breathe?",
    es: "¿Cuál es un momento que te hizo reír tanto que no podías respirar?",
    randomizeOptions: {
      en: [
        "My nieta dressed the cat in a christening gown and told me he was the new priest. I sat down on the floor.",
        "Watching my buddy get stung by a wasp on a fishing trip. He fell out of the boat. I'm a bad friend.",
        "My friend Dee did an impression of her therapist. I started crying in a coffee shop.",
        "My wife, in 1972, attempted to flirt in French with a Parisian waiter. He laughed; we laughed; we have, in fifty-five years, not stopped.",
      ],
      es: [
        "Mi nieta vistió al gato con una bata de bautizo y me dijo que era el nuevo cura. Me senté en el piso.",
        "Ver a mi amigo picado por una avispa en una pesca. Se cayó del bote. Soy mal amigo.",
        "Mi amiga Dee imitó a su terapeuta. Empecé a llorar en una cafetería.",
        "Mi esposa, en 1972, intentó coquetear en francés con un mesero parisino. Él se rió; nosotros nos reímos; en cincuenta y cinco años, no hemos parado.",
      ],
    },
  },
  {
    id: 30,
    category: "self",
    depth: "texture",
    en: "What's a small thing you do every day that almost no one knows about?",
    es: "¿Cuál es una cosa pequeña que haces todos los días que casi nadie sabe?",
    randomizeOptions: {
      en: [
        "I kiss the photo of my Hector before I leave the house. Every time.",
        "Push-ups. Twenty. Same number since I was nineteen.",
        "I write down one thing I want to remember in a little blue notebook. I never reread it.",
        "I read a single poem with my morning tea. It need not be a great poem. It must be a poem.",
      ],
      es: [
        "Beso la foto de mi Hector antes de salir de la casa. Cada vez.",
        "Lagartijas. Veinte. El mismo número desde los diecinueve.",
        "Escribo una cosa que quiero recordar en una libretita azul. Nunca la releo.",
        "Leo un poema con el té de la mañana. No tiene que ser grandioso. Tiene que ser un poema.",
      ],
    },
  },

  // — Depth (31–45) —
  {
    id: 31,
    category: "love",
    depth: "depth",
    en: "Who in your life has loved you best, and how could you tell?",
    es: "¿Quién en tu vida te ha querido mejor, y cómo lo sabías?",
    randomizeOptions: {
      en: [
        "Mi Hector. He cut me sandwiches without crusts for forty-one years. Without me asking. That is love.",
        "My mom. She never said it. But she was there. She was always there.",
        "My friend Mae. She has shown up for every funeral, every move, every middle-of-the-night call. Twenty years.",
        "My wife. The proof is in the small kindnesses, performed without performance, day upon day.",
      ],
      es: [
        "Mi Hector. Me cortó sándwiches sin corteza por cuarenta y un años. Sin que se lo pidiera. Eso es amor.",
        "Mi mamá. Nunca lo dijo. Pero estaba ahí. Siempre estaba ahí.",
        "Mi amiga Mae. Ha aparecido en cada funeral, cada mudanza, cada llamada de la madrugada. Veinte años.",
        "Mi esposa. La prueba está en las pequeñas bondades, realizadas sin teatro, día tras día.",
      ],
    },
  },
  {
    id: 32,
    category: "stories",
    depth: "depth",
    en: "What's a moment you knew, even as it was happening, that you'd remember it forever?",
    es: "¿Cuál es un momento en el que supiste, mientras estaba pasando, que lo recordarías para siempre?",
    randomizeOptions: {
      en: [
        "Holding my first nieto. Out loud I said gracias a Dios. Inside I was thunderstruck.",
        "Day my daughter was born. I sat on the curb outside the hospital and didn't move for an hour.",
        "First time I read a poem and felt my chest crack open. I was sixteen, on a bus, going nowhere.",
        "The afternoon my wife said yes. The light through the window was particular. I was paying attention.",
      ],
      es: [
        "Cargando a mi primer nieto. En voz alta dije gracias a Dios. Por dentro me cayó un rayo.",
        "El día que nació mi hija. Me senté en la banqueta fuera del hospital y no me moví por una hora.",
        "La primera vez que leí un poema y sentí algo abrirse en el pecho. Tenía dieciséis, en un autobús, sin ir a ningún lado.",
        "La tarde que mi esposa dijo sí. La luz por la ventana era particular. Estaba prestando atención.",
      ],
    },
  },
  {
    id: 33,
    category: "family",
    depth: "depth",
    en: "What did your father teach you — in his words or just the way he lived?",
    es: "¿Qué te enseñó tu padre — con sus palabras o con la forma en que vivió?",
    randomizeOptions: {
      en: [
        "Que la palabra de un hombre vale más que el dinero. He buried two friends rather than break a promise.",
        "Show up. Even when you don't want to. Especially then.",
        "He taught me, through absence mostly, what kind of father I would have to become.",
        "He taught me that one's life is best measured not in achievements but in the integrity of one's quiet decisions.",
      ],
      es: [
        "Que la palabra de un hombre vale más que el dinero. Enterró a dos amigos en vez de romper una promesa.",
        "Aparece. Aunque no quieras. Sobre todo entonces.",
        "Me enseñó, mayormente por su ausencia, qué tipo de padre tendría que ser yo.",
        "Me enseñó que la vida de uno se mide mejor no por los logros, sino por la integridad de las decisiones calladas.",
      ],
    },
  },
  {
    id: 34,
    category: "family",
    depth: "depth",
    en: "What did your mother teach you — in her words or just the way she lived?",
    es: "¿Qué te enseñó tu madre — con sus palabras o con la forma en que vivió?",
    randomizeOptions: {
      en: [
        "A coser, a rezar, a cocinar para diez con dos. To stretch what you have until it covers everyone.",
        "Toughness. She raised three of us by herself and never once complained where we could hear.",
        "How to apologize. Specifically and without excuses. She got it wrong many times and showed me how to get it right.",
        "She taught me that beauty was a duty — that to make a meal, a room, a sentence well was an offering.",
      ],
      es: [
        "A coser, a rezar, a cocinar para diez con dos. Estirar lo que tienes hasta que alcance para todos.",
        "Aguantar. Nos crio a los tres sola y nunca se quejó donde la oyéramos.",
        "Cómo pedir perdón. Específico y sin excusas. Se equivocó muchas veces y me enseñó a hacerlo bien.",
        "Me enseñó que la belleza era un deber — que hacer bien una comida, un cuarto, una oración era una ofrenda.",
      ],
    },
  },
  {
    id: 35,
    category: "love",
    depth: "depth",
    en: "Who taught you something important without ever sitting you down to teach it?",
    es: "¿Quién te enseñó algo importante sin haberse sentado nunca a enseñártelo?",
    randomizeOptions: {
      en: [
        "Mi vecina, doña Hilda. She fed any hungry kid on the block. She taught me hospitality is theology.",
        "Mr. Greene at the auto shop. Showed me how to listen to an engine. Showed me how to listen, period.",
        "My older sister. By the way she handled her own grief. She didn't perform it. She lived it.",
        "An old groundskeeper at the college. He spoke seldom. He worked carefully. He greeted everyone.",
      ],
      es: [
        "Mi vecina, doña Hilda. Le daba de comer a cualquier niño con hambre en la cuadra. Me enseñó que la hospitalidad es teología.",
        "Mr. Greene en el taller. Me enseñó a escuchar un motor. Me enseñó a escuchar, en general.",
        "Mi hermana mayor. Por la forma en que cargó con su propio duelo. No lo actuó. Lo vivió.",
        "Un viejo jardinero en la universidad. Hablaba poco. Trabajaba con cuidado. Saludaba a todo el mundo.",
      ],
    },
  },
  {
    id: 36,
    category: "self",
    depth: "depth",
    en: "What were you most afraid of as a child? Are you still afraid of it?",
    es: "¿A qué le tenías más miedo cuando eras niño? ¿Todavía le tienes miedo?",
    randomizeOptions: {
      en: [
        "El diablo. La verdad. Now I am more afraid of indifference. The devil at least bothers to show up.",
        "My dad's temper. He died when I was thirty-one. The fear took longer to die than he did.",
        "Being abandoned. I am still afraid of it. I think it's why I check my phone like a lunatic.",
        "Death, of course. With time and reading I have come not to fear it; I do, however, regret its inconvenience.",
      ],
      es: [
        "El diablo. La verdad. Ahora le temo más a la indiferencia. El diablo al menos se molesta en aparecer.",
        "El temperamento de mi papá. Murió cuando yo tenía treinta y uno. El miedo tardó más en morir que él.",
        "Que me abandonaran. Todavía me da miedo. Creo que por eso reviso el teléfono como una loca.",
        "La muerte, por supuesto. Con el tiempo y la lectura he dejado de temerla; lamento, sin embargo, lo inconveniente que es.",
      ],
    },
  },
  {
    id: 37,
    category: "advice",
    depth: "depth",
    en: "What advice would you give your 25-year-old self, and would they have listened?",
    es: "¿Qué consejo le darías a tu yo de 25 años, y te habría hecho caso?",
    randomizeOptions: {
      en: [
        "Llama a tu mamá más. Y no, you wouldn't have. You were too sure of forever.",
        "Save more, drink less. Twenty-five-year-old me would've laughed and ordered another.",
        "Stop trying to be ready. Just go. She wouldn't have listened. She had to learn.",
        "Be patient with the woman; she will become the love of your life. Twenty-five would have rolled his eyes and continued his apprenticeship in foolishness.",
      ],
      es: [
        "Llama a tu mamá más. Y no, no me habría hecho caso. Estaba muy segura de que el siempre era cierto.",
        "Ahorra más, bebe menos. El yo de veinticinco se habría reído y pedido otra.",
        "Deja de intentar estar lista. Solo vete. No me habría escuchado. Tuve que aprender.",
        "Sé paciente con la mujer; será el amor de tu vida. Yo de veinticinco habría puesto los ojos en blanco y seguido su aprendizaje en la insensatez.",
      ],
    },
  },
  {
    id: 38,
    category: "values",
    depth: "depth",
    en: "What's a decision you're most proud you made, even if no one else noticed?",
    es: "¿Cuál es una decisión que te enorgullece haber tomado, aunque nadie más se haya dado cuenta?",
    randomizeOptions: {
      en: [
        "I forgave my brother before he died. Nadie sabía que estábamos peleados. He died knowing.",
        "I stopped drinking nineteen years ago. Nobody throws me a parade in October. I notice.",
        "I left a job that paid me well to do something that meant something. Six years in. Still right.",
        "I declined a promotion that would have separated me from my wife. The colleague who took it became a vice-president and a stranger to his children.",
      ],
      es: [
        "Perdoné a mi hermano antes de que muriera. Nadie sabía que estábamos peleados. Él murió sabiendo.",
        "Dejé de beber hace diecinueve años. Nadie me hace un desfile en octubre. Yo me doy cuenta.",
        "Dejé un trabajo bien pagado por algo que tenía sentido. Seis años después. Sigue siendo correcto.",
        "Rechacé un ascenso que me habría separado de mi esposa. El colega que lo tomó se hizo vicepresidente y un extraño a sus hijos.",
      ],
    },
  },
  {
    id: 39,
    category: "stories",
    depth: "depth",
    en: "When have you felt most alive?",
    es: "¿Cuándo te has sentido más vivo?",
    randomizeOptions: {
      en: [
        "Bailando bachata at my niece's wedding. Sixty-eight years old and the whole floor cleared for me.",
        "Hauling a 30-pound striper out of the bay at sunrise. I yelled. I'm not a yelling guy.",
        "Three a.m. in Lisbon, lost, eating something I couldn't name, with two strangers who became friends.",
        "Sailing alone, fifteen miles offshore, fall of '78, thinking nothing in particular. I have not felt more alive since.",
      ],
      es: [
        "Bailando bachata en la boda de mi sobrina. Sesenta y ocho años y la pista entera se abrió para mí.",
        "Sacando un robalo de catorce kilos de la bahía al amanecer. Grité. No soy de gritar.",
        "Tres de la mañana en Lisboa, perdida, comiendo algo que no podía nombrar, con dos desconocidos que se hicieron amigos.",
        "Navegando solo, a veinticinco kilómetros de la costa, otoño del 78, sin pensar en nada en particular. No me he sentido más vivo desde entonces.",
      ],
    },
  },
  {
    id: 40,
    category: "love",
    depth: "depth",
    en: "Who do you miss, and what do you miss about them most?",
    es: "¿A quién extrañas, y qué es lo que más extrañas de esa persona?",
    randomizeOptions: {
      en: [
        "Mi Hector. Lo que más extraño es la forma en que respiraba en la noche. The shape of him.",
        "My old man. I miss the way he'd say my name when I walked in the room. Like a question and an answer.",
        "My grandmother. I miss her hands. Specifically, her hands on my hair when I was sick.",
        "My friend Ed, gone these eleven years. I miss having someone who knew me before I knew myself.",
      ],
      es: [
        "Mi Hector. Lo que más extraño es la forma en que respiraba en la noche. La forma de él.",
        "Mi viejo. Extraño la forma en que decía mi nombre cuando entraba al cuarto. Como pregunta y respuesta.",
        "Mi abuela. Extraño sus manos. Específicamente, sus manos en mi pelo cuando estaba enferma.",
        "Mi amigo Ed, hace once años que se fue. Extraño tener a alguien que me conoció antes de que yo me conociera.",
      ],
    },
  },
  {
    id: 41,
    category: "self",
    depth: "depth",
    en: "What's something you've changed your mind about as you've gotten older?",
    es: "¿Sobre qué has cambiado de opinión a medida que has crecido?",
    randomizeOptions: {
      en: [
        "Que el orgullo era una virtud. No era. Era un freno.",
        "I used to think being right mattered. Mostly it doesn't. Mostly people just want to feel heard.",
        "I used to think I had to fix everyone. Now I just sit with them. They fix themselves better.",
        "I once believed certainty a sign of strength. I now consider it a sign of insufficient reading.",
      ],
      es: [
        "Que el orgullo era una virtud. No era. Era un freno.",
        "Pensaba que tener razón importaba. La mayoría del tiempo no. La gente sólo quiere sentirse escuchada.",
        "Pensaba que tenía que arreglar a todos. Ahora me siento con ellos. Se arreglan mejor solos.",
        "Antes creía que la certeza era señal de fortaleza. Ahora la considero señal de lectura insuficiente.",
      ],
    },
  },
  {
    id: 42,
    category: "values",
    depth: "depth",
    en: "What's something you forgive easily, and something you find hard to forgive?",
    es: "¿Qué perdonas fácilmente, y qué te cuesta perdonar?",
    randomizeOptions: {
      en: [
        "Forgivo fácil al que no sabía. Cruelty when someone knew exactly what they were doing — that one I am still working on.",
        "I forgive a temper. I don't forgive a coward.",
        "Easy: someone forgetting my birthday. Hard: someone making me feel small for being myself.",
        "I forgive ignorance readily and contempt with great difficulty. The first improves with patience; the second is a choice.",
      ],
      es: [
        "Perdono fácil al que no sabía. La crueldad cuando alguien sabía exactamente lo que hacía — esa todavía la trabajo.",
        "Perdono el carácter. No perdono al cobarde.",
        "Fácil: que se olviden de mi cumpleaños. Difícil: que me hagan sentir pequeña por ser yo.",
        "Perdono la ignorancia con facilidad y el desprecio con gran dificultad. El primero mejora con paciencia; el segundo es elección.",
      ],
    },
  },
  {
    id: 43,
    category: "love",
    depth: "depth",
    en: "What's the kindest thing anyone has ever done for you?",
    es: "¿Cuál es la cosa más bondadosa que alguien ha hecho por ti?",
    randomizeOptions: {
      en: [
        "Mi vecina watched my babies for three weeks when Hector was in the hospital. No le pregunté. Just appeared.",
        "My boss gave me three weeks paid when my mom died. He said, 'Don't come back too soon.'",
        "A stranger, in a coffee shop, sat with me when I was crying. Didn't say anything. Stayed twenty minutes.",
        "When I was sick in '99, my neighbor read to me for three hours every Sunday for two months. I had not asked.",
      ],
      es: [
        "Mi vecina cuidó a mis bebés tres semanas cuando Hector estaba en el hospital. No le pregunté. Apareció.",
        "Mi jefe me dio tres semanas pagadas cuando murió mi mamá. Me dijo: 'No regreses muy pronto.'",
        "Una desconocida, en una cafetería, se sentó conmigo cuando lloraba. No dijo nada. Se quedó veinte minutos.",
        "Cuando estuve enfermo en el 99, mi vecino me leyó tres horas cada domingo por dos meses. No se lo había pedido.",
      ],
    },
  },
  {
    id: 44,
    category: "advice",
    depth: "depth",
    en: "If someone you loved was about to make a big mistake, what would you tell them, and how?",
    es: "Si alguien que amas estuviera por cometer un gran error, ¿qué le dirías, y cómo?",
    randomizeOptions: {
      en: [
        "Le diría: te quiero. Y te equivocas. Pero estoy aquí cuando te des cuenta.",
        "I'd say it once. Plain. Then I'd shut up. Lectures don't work. Only love does.",
        "I'd ask them what they think the worst version of this looks like. Then I'd ask them if they could live with it.",
        "I would tell the truth, gently and clearly, exactly once, and then I would refrain from telling it again, no matter how tempted.",
      ],
      es: [
        "Le diría: te quiero. Y te equivocas. Pero estoy aquí cuando te des cuenta.",
        "Lo diría una vez. Claro. Después callado. Los sermones no sirven. Sólo el amor.",
        "Le preguntaría cómo cree que se ve la peor versión de esto. Y luego si podría vivir con ella.",
        "Diría la verdad, con gentileza y claridad, una sola vez, y me abstendría de repetirla, por más tentado que estuviera.",
      ],
    },
  },
  {
    id: 45,
    category: "self",
    depth: "depth",
    en: "What do you wish more people understood about you?",
    es: "¿Qué te gustaría que más gente entendiera de ti?",
    randomizeOptions: {
      en: [
        "Que mi suavidad no es debilidad. La he ganado.",
        "I'm not as quiet because I have nothing to say. I'm quiet because I'm listening.",
        "I think a lot. About everything. The blank face is processing, not absence.",
        "I am not as cheerful as my exterior suggests; I have simply concluded that complaint serves no purpose I respect.",
      ],
      es: [
        "Que mi suavidad no es debilidad. La he ganado.",
        "No estoy callado porque no tenga qué decir. Estoy callado porque estoy escuchando.",
        "Pienso mucho. En todo. La cara en blanco es procesamiento, no ausencia.",
        "No soy tan alegre como mi exterior sugiere; simplemente he concluido que la queja no sirve a ningún propósito que yo respete.",
      ],
    },
  },

  // — Soul (46–50) —
  {
    id: 46,
    category: "quiet",
    depth: "soul",
    en: "What's your most private joy — the one you don't quite talk about?",
    es: "¿Cuál es tu alegría más privada — esa de la que no hablas mucho?",
    randomizeOptions: {
      en: [
        "Cuando rezo el rosario solita y siento que alguien me escucha. No se lo digo a nadie porque no lo entenderían.",
        "Sitting in the truck after work for fifteen minutes before going inside. Nobody needing me. Don't tell my wife.",
        "Reading in the morning before anyone else is up. The world quiet, mine briefly.",
        "Translating a difficult passage of poetry until it sings in English. I tell almost no one. They wouldn't see why I am moved.",
      ],
      es: [
        "Cuando rezo el rosario solita y siento que alguien me escucha. No se lo digo a nadie porque no lo entenderían.",
        "Sentarme en la camioneta quince minutos después del trabajo antes de entrar. Nadie me necesita. No le digas a mi esposa.",
        "Leer en la mañana antes de que se despierten los demás. El mundo callado, mío por un rato.",
        "Traducir un pasaje difícil de poesía hasta que cante en inglés. Casi a nadie le digo. No entenderían por qué me conmueve.",
      ],
    },
  },
  {
    id: 47,
    category: "values",
    depth: "soul",
    en: "What do you hope is true about what happens after we die?",
    es: "¿Qué esperas que sea cierto sobre lo que pasa después de morir?",
    randomizeOptions: {
      en: [
        "Que mi mami me esté esperando con un café. Y que Hector le haya enseñado a hacerlo como me gusta.",
        "I hope it's quiet. I hope it doesn't hurt. I'd like to see my old dog.",
        "I hope it's a long, slow morning with all the people I've ever loved. Coffee, no plans.",
        "I hope to find that I was wrong about most things and right about kindness. The rest, I shall accept with curiosity.",
      ],
      es: [
        "Que mi mami me esté esperando con un café. Y que Hector le haya enseñado a hacerlo como me gusta.",
        "Espero que sea callado. Espero que no duela. Me gustaría ver a mi perro viejo.",
        "Espero que sea una mañana larga y lenta con todas las personas que he querido. Café, sin planes.",
        "Espero descubrir que me equivoqué en la mayoría de las cosas y acerté en la bondad. Lo demás lo aceptaré con curiosidad.",
      ],
    },
  },
  {
    id: 48,
    category: "love",
    depth: "soul",
    en: "If you could send one text to someone you've lost, what would it say?",
    es: "Si pudieras mandar un solo mensaje a alguien que perdiste, ¿qué diría?",
    randomizeOptions: {
      en: [
        "Hector. Estoy bien. La nena se casó. La rosa que sembraste sigue dando.",
        "Pop. I made it. The boys are fine. I think about you every Sunday.",
        "I did the thing you said I couldn't do. I did it scared. Thank you.",
        "I am, at last, the man you suspected I might become. I miss you weekly. Yours.",
      ],
      es: [
        "Hector. Estoy bien. La nena se casó. La rosa que sembraste sigue dando.",
        "Pa. Salí adelante. Los muchachos están bien. Pienso en ti cada domingo.",
        "Hice eso que dijiste que no podía hacer. Lo hice con miedo. Gracias.",
        "Por fin soy el hombre que sospechabas que podría llegar a ser. Te extraño cada semana. Tuyo.",
      ],
    },
  },
  {
    id: 49,
    category: "legacy",
    depth: "soul",
    en: "What do you want to be remembered for — the real answer, not the polished one?",
    es: "¿Por qué quieres ser recordado — la respuesta real, no la pulida?",
    randomizeOptions: {
      en: [
        "Que cocinaba bien y que mi casa siempre tenía la puerta abierta. Eso es. No necesito más.",
        "That I showed up. Not the parade stuff. The 2 a.m. drives. The Tuesday phone calls.",
        "That I made the room safer for someone to be themselves. That's the only thing that's ever mattered to me.",
        "That I attended, faithfully, to the small. The grand things take care of themselves.",
      ],
      es: [
        "Que cocinaba bien y que mi casa siempre tenía la puerta abierta. Eso es. No necesito más.",
        "Que aparecí. No las cosas de desfile. Los viajes a las 2 a.m. Las llamadas del martes.",
        "Que hice el cuarto más seguro para que alguien fuera ella misma. Es lo único que me ha importado.",
        "Que atendí, con fidelidad, a lo pequeño. Lo grande se ocupa solo de sí mismo.",
      ],
    },
  },
  {
    id: 50,
    category: "legacy",
    depth: "soul",
    en: "When the people who love you tell stories about you years from now, what do you hope they say?",
    es: "Cuando las personas que te quieren cuenten historias sobre ti dentro de muchos años, ¿qué esperas que digan?",
    randomizeOptions: {
      en: [
        "Que abuela cantaba, aunque desafinaba. Que abuela siempre dejaba la puerta abierta. Que abuela los quiso de a deveras.",
        "He was a hard man and a fair one. He raised us right. He made us laugh when we needed it.",
        "She loved the small things hard. She remembered everyone's coffee order. She cried at the right movies.",
        "He was, above all, a good listener — a thing increasingly rare in his time, and one we would do well to imitate.",
      ],
      es: [
        "Que abuela cantaba, aunque desafinaba. Que abuela siempre dejaba la puerta abierta. Que abuela los quiso de a deveras.",
        "Era un hombre duro y justo. Nos crio bien. Nos hizo reír cuando lo necesitábamos.",
        "Quería duro las cosas pequeñas. Se acordaba del café de cada quien. Lloraba con las películas correctas.",
        "Era, sobre todo, un buen escucha — cosa cada vez más rara en su tiempo, y una que haríamos bien en imitar.",
      ],
    },
  },

  // — Batch 2: Surface (51), Texture (52–61), Depth (62–73), Soul (74–75) —
  {
    id: 51,
    category: "self",
    depth: "surface",
    en: "Is there an object you've kept for far too long? What is it?",
    es: "¿Hay algún objeto que has guardado por demasiado tiempo? ¿Cuál?",
    randomizeOptions: {
      en: [
        "El delantal de mi mami. Manchado, con un hueco. No lo voy a tirar.",
        "A coffee mug from my first job. Chipped on the rim. Still my favorite.",
        "A movie ticket from a date in 2014. I keep it in a book I never finished.",
        "A fountain pen given to me upon graduation in 1966. The nib is, by now, idiosyncratically mine.",
      ],
      es: [
        "El delantal de mi mami. Manchado, con un hueco. No lo voy a tirar.",
        "Una taza de café de mi primer trabajo. Despostillada en el borde. Sigue siendo mi favorita.",
        "Un boleto de cine de una cita en 2014. Lo tengo en un libro que nunca terminé.",
        "Una pluma fuente que me regalaron al graduarme en 1966. La punta, a estas alturas, es idiosincráticamente mía.",
      ],
    },
  },
  {
    id: 52,
    category: "childhood",
    depth: "texture",
    en: "Who was your favorite teacher, and what made them yours?",
    es: "¿Quién fue tu maestro favorito, y qué lo hacía tuyo?",
    randomizeOptions: {
      en: [
        "Hermana Alicia. Strict like the others, but she would slip me a caramel when I cried.",
        "Mr. Kovacs, shop class. He didn't talk much. He taught me to measure twice. Cut once.",
        "Ms. Aldana in tenth grade. She read my essay out loud and didn't tell anyone it was mine.",
        "Dr. Maitland, in graduate school. She listened as if I might say something worth hearing, and so I did.",
      ],
      es: [
        "Hermana Alicia. Estricta como las otras, pero me pasaba un caramelo cuando lloraba.",
        "Mr. Kovacs, taller. Hablaba poco. Me enseñó a medir dos veces. Cortar una.",
        "Ms. Aldana, en décimo. Leyó mi ensayo en voz alta y no le dijo a nadie que era mío.",
        "La doctora Maitland, en el posgrado. Escuchaba como si yo pudiera decir algo digno, y así lo hice.",
      ],
    },
  },
  {
    id: 53,
    category: "family",
    depth: "texture",
    en: "What's something a grandparent did that always meant safety to you?",
    es: "¿Qué hacía un abuelo o abuela que para ti siempre significó estar a salvo?",
    randomizeOptions: {
      en: [
        "Mi abuelo pasaba la mano por mi cabello cuando yo dormía. I would pretend to be asleep so he would keep doing it.",
        "Granddad tucked the blanket under my feet. Every night. Couldn't sleep without it.",
        "My grandma would hum while she cooked. Specific song, no name. The hum meant nobody was angry.",
        "My grandfather, on stormy nights, would simply sit in the room and read. His presence was the lullaby.",
      ],
      es: [
        "Mi abuelo pasaba la mano por mi cabello cuando yo dormía. Yo me hacía la dormida para que siguiera.",
        "Mi abuelo metía la cobija debajo de mis pies. Cada noche. Sin eso no dormía.",
        "Mi abuela tarareaba mientras cocinaba. Una canción específica, sin nombre. El tarareo decía que nadie estaba enojado.",
        "Mi abuelo, en noches de tormenta, simplemente se sentaba en el cuarto a leer. Su presencia era la canción de cuna.",
      ],
    },
  },
  {
    id: 54,
    category: "family",
    depth: "texture",
    en: "Tell me about a fight with a sibling you remember vividly.",
    es: "Cuéntame de una pelea con un hermano que recuerdes vívidamente.",
    randomizeOptions: {
      en: [
        "Con mi hermana, sobre quién iba a usar el vestido amarillo en la fiesta. I won. Lo lamento todavía.",
        "My brother and I went at it over a Nintendo. I bit him. Mom didn't speak to me for a day.",
        "My sister borrowed my jacket without asking and lost it. We didn't speak for two months. Her loss too.",
        "My brother and I disagreed, in 1958, about a baseball card. The argument continues in our hearts to this day.",
      ],
      es: [
        "Con mi hermana, sobre quién iba a usar el vestido amarillo en la fiesta. Gané. Lo lamento todavía.",
        "Mi hermano y yo nos agarramos por un Nintendo. Le mordí. Mi mamá no me habló por un día.",
        "Mi hermana me prestó la chaqueta sin pedírmela y la perdió. No nos hablamos por dos meses. Ella perdió también.",
        "Mi hermano y yo nos peleamos, en 1958, por una tarjeta de béisbol. El argumento continúa en nuestros corazones hasta hoy.",
      ],
    },
  },
  {
    id: 55,
    category: "work",
    depth: "texture",
    en: "What did you do with the first real money you ever earned?",
    es: "¿Qué hiciste con el primer dinero de verdad que ganaste?",
    randomizeOptions: {
      en: [
        "Le compré un broche de oro a mi mami. Ella lloró y me dijo que estaba loca. Lo guardó.",
        "Bought my old man a six-pack and put the rest in a coffee can. Most of it stayed there.",
        "Took my mom to a real restaurant. We didn't know what to order. She kept the menu.",
        "Acquired, with great care, a first-edition volume of Auden. I have it still, on the third shelf.",
      ],
      es: [
        "Le compré un broche de oro a mi mami. Ella lloró y me dijo que estaba loca. Lo guardó.",
        "Le compré a mi viejo un seis de cervezas y el resto lo metí en una lata de café. Casi todo se quedó ahí.",
        "Llevé a mi mamá a un restaurante de verdad. No sabíamos qué pedir. Se quedó con el menú.",
        "Adquirí, con gran cuidado, una primera edición de Auden. La tengo aún, en el tercer estante.",
      ],
    },
  },
  {
    id: 56,
    category: "self",
    depth: "texture",
    en: "Who used to call you the most, before texting took over? What did you talk about?",
    es: "¿Quién te llamaba más antes de que los mensajes tomaran el lugar? ¿De qué hablaban?",
    randomizeOptions: {
      en: [
        "Mi tía Olga. Daily. Sobre nada y todo. The novela. El tiempo. Mi peso.",
        "My mom. Every Sunday. The weather. The lawn. Then we'd hang up.",
        "My best friend from college. We'd talk an hour, mostly silence and occasional snorts.",
        "My old colleague Walter. We dissected matters of state with the seriousness of senators and the humor of schoolboys.",
      ],
      es: [
        "Mi tía Olga. Diario. Sobre nada y todo. La novela. El tiempo. Mi peso.",
        "Mi mamá. Cada domingo. El tiempo. El zacate. Y después colgábamos.",
        "Mi mejor amigo de la universidad. Hablábamos una hora, casi puro silencio y resoplidos ocasionales.",
        "Mi viejo colega Walter. Diseccionábamos asuntos de Estado con la seriedad de senadores y el humor de colegiales.",
      ],
    },
  },
  {
    id: 57,
    category: "self",
    depth: "texture",
    en: "What's a sound that, anywhere in the world, means home to you?",
    es: "¿Qué sonido, en cualquier parte del mundo, significa hogar para ti?",
    randomizeOptions: {
      en: [
        "El golpe de la cuchara contra la olla cuando se hace sofrito.",
        "The screen door slamming. Twice — never just once.",
        "Rain on a metal roof. Doesn't matter where; it puts me back home.",
        "The chiming of the grandfather clock at the half-hour. My father wound it every Sunday for fifty years.",
      ],
      es: [
        "El golpe de la cuchara contra la olla cuando se hace sofrito.",
        "La puerta de tela tronando. Dos veces — nunca una sola.",
        "La lluvia en un techo de lámina. No importa dónde; me regresa a casa.",
        "Las campanadas del reloj de pie a la media hora. Mi padre lo daba cuerda cada domingo durante cincuenta años.",
      ],
    },
  },
  {
    id: 58,
    category: "self",
    depth: "texture",
    en: "What's a meal you'd eat as your last, and who would you want at the table?",
    es: "¿Cuál sería tu última cena, y a quién quisieras en la mesa?",
    randomizeOptions: {
      en: [
        "Arroz con frijoles negros, lechón, plátanos maduros. Mi familia entera. Hector al lado mío.",
        "A T-bone, medium rare. Baked potato. Beer. My boys. My old man if he were still here.",
        "A bowl of perfect ramen, alone, in a clean kitchen. Just me, and my dog if she'll come.",
        "A simple sole meunière, with my wife, by candlelight. We have not needed the table to be loud.",
      ],
      es: [
        "Arroz con frijoles negros, lechón, plátanos maduros. Mi familia entera. Hector al lado mío.",
        "Un T-bone, término medio. Papa al horno. Cerveza. Mis hijos. Mi viejo si estuviera.",
        "Un tazón de ramen perfecto, sola, en una cocina limpia. Sólo yo, y mi perra si quiere venir.",
        "Un sencillo lenguado meunière, con mi esposa, a la luz de las velas. No hemos necesitado que la mesa sea ruidosa.",
      ],
    },
  },
  {
    id: 59,
    category: "stories",
    depth: "texture",
    en: "What's a small kindness you witnessed that you've never forgotten?",
    es: "¿Cuál es un pequeño acto de bondad que viste y nunca olvidaste?",
    randomizeOptions: {
      en: [
        "A man at the bus stop gave his sandwich to a hungry boy. No le dijo nada. Solo lo hizo.",
        "Watched a stranger pay for the woman behind him at the diner. Didn't tell her.",
        "A woman on the subway gave her seat to someone who didn't need it but looked tired. I needed that day.",
        "A colleague, decades ago, tucked a kind anonymous note into the office of a junior who had just lost a parent.",
      ],
      es: [
        "Un hombre en la parada del bus le dio su sándwich a un niño con hambre. No le dijo nada. Sólo lo hizo.",
        "Vi a un desconocido pagar por la señora detrás de él en el restaurante. No le dijo.",
        "Una señora en el metro le cedió su asiento a alguien que no lo necesitaba pero parecía cansado. Yo lo necesitaba ese día.",
        "Un colega, décadas atrás, deslizó una nota amable y anónima en la oficina de un junior que acababa de perder a un padre.",
      ],
    },
  },
  {
    id: 60,
    category: "self",
    depth: "texture",
    en: "What does a perfect Sunday look like for you?",
    es: "¿Cómo es para ti un domingo perfecto?",
    randomizeOptions: {
      en: [
        "Misa, café con mis nietos, una novela en la tarde. Una llamada de mi hermana.",
        "Slow morning, eggs, the paper, a long walk. Game on at one. Nap by three.",
        "Coffee, a book in bed until eleven. A long walk, ideally somewhere with a body of water. Phone off.",
        "An early breakfast, a brisk constitutional, and the afternoon spent rereading Auden by the fire.",
      ],
      es: [
        "Misa, café con mis nietos, una novela en la tarde. Una llamada de mi hermana.",
        "Mañana lenta, huevos, el periódico, una caminata larga. El juego a la una. Siesta a las tres.",
        "Café, un libro en la cama hasta las once. Caminata larga, idealmente cerca de agua. Teléfono apagado.",
        "Un desayuno temprano, una caminata vigorosa, y la tarde releyendo a Auden junto al fuego.",
      ],
    },
  },
  {
    id: 61,
    category: "love",
    depth: "texture",
    en: "Who's the friend you would call at 4 a.m.? Why them?",
    es: "¿Quién es el amigo al que llamarías a las 4 de la mañana? ¿Por qué a esa persona?",
    randomizeOptions: {
      en: [
        "Mi comadre Hilda. Knows everything. Tells nothing. Says \"ven, mi amor\" and that's enough.",
        "Tony from the shop. He won't ask why. He'll just show up.",
        "My friend Mae. She has the gift of not making it about her.",
        "Walter. We have, over decades, established that a 4 a.m. call requires no apology and certainly no explanation.",
      ],
      es: [
        "Mi comadre Hilda. Sabe todo. No cuenta nada. Dice \"ven, mi amor\" y con eso basta.",
        "Tony del taller. No va a preguntar por qué. Sólo aparece.",
        "Mi amiga Mae. Tiene el don de no hacer la cosa sobre ella.",
        "Walter. Hemos establecido, durante décadas, que una llamada a las 4 a.m. no requiere disculpa y desde luego ninguna explicación.",
      ],
    },
  },
  {
    id: 62,
    category: "self",
    depth: "depth",
    en: "When have you been most scared, and gone forward anyway?",
    es: "¿Cuándo has tenido más miedo, y aun así seguiste adelante?",
    randomizeOptions: {
      en: [
        "Cuando me subí al avión a Miami a los veintidós. No conocía a nadie. Recé el rosario entero.",
        "Day I quit my job at the plant with no plan. Twenty-eight years old. Ate a lot of beans that year.",
        "Telling my parents I wasn't going to law school. I rehearsed it for a month. They cried. So did I.",
        "Returning, in 1953, to college after the war. The boys around me looked impossibly young. I sat down anyway.",
      ],
      es: [
        "Cuando me subí al avión a Miami a los veintidós. No conocía a nadie. Recé el rosario entero.",
        "El día que renuncié a la planta sin plan. Veintiocho años. Comí muchos frijoles ese año.",
        "Cuando le dije a mis padres que no iba a estudiar derecho. Lo ensayé un mes. Lloraron. Yo también.",
        "Al regresar, en 1953, a la universidad después de la guerra. Los jóvenes alrededor parecían imposiblemente jóvenes. Me senté igual.",
      ],
    },
  },
  {
    id: 63,
    category: "self",
    depth: "depth",
    en: "What's a failure that taught you more than any success?",
    es: "¿Cuál es un fracaso que te enseñó más que cualquier éxito?",
    randomizeOptions: {
      en: [
        "Mi primer matrimonio. I was twenty. He was wrong for me. I learned to listen to my gut.",
        "Lost a business in '08. Watched it die. Came out leaner, less proud, better at asking for help.",
        "A relationship I held onto two years past its expiration date. Taught me what I will not do again.",
        "I lost a paper, in 1971, that I had labored over for two years. The work, I have come to understand, was a man preparing his future without his knowledge.",
      ],
      es: [
        "Mi primer matrimonio. Tenía veinte. Él no era para mí. Aprendí a hacerle caso a mi corazonada.",
        "Perdí un negocio en el 08. Vi cómo moría. Salí más flaco, menos orgulloso, mejor en pedir ayuda.",
        "Una relación que sostuve dos años después de su fecha. Me enseñó lo que no volveré a hacer.",
        "Perdí un trabajo, en 1971, sobre el que había trabajado dos años. La labor, he llegado a comprender, era un hombre preparando su futuro sin saberlo.",
      ],
    },
  },
  {
    id: 64,
    category: "love",
    depth: "depth",
    en: "When has a stranger left a mark on your life?",
    es: "¿Cuándo te dejó huella un desconocido?",
    randomizeOptions: {
      en: [
        "Una señora en la guagua. I was crying. Me agarró la mano. No dijo nada. Twenty minutes.",
        "Old guy at a diner counter, told me, \"don't be the kind of man who waits.\" I haven't.",
        "A woman in line at a pharmacy paid for my prescription when my card was declined. I was too embarrassed to thank her. I think of her.",
        "A boy of about ten, in Italy, gave me a flower. He spoke no English. I have remembered this for forty-six years.",
      ],
      es: [
        "Una señora en la guagua. Yo lloraba. Me agarró la mano. No dijo nada. Veinte minutos.",
        "Un viejo en la barra de un restaurante me dijo: \"no seas el tipo de hombre que espera.\" No lo he sido.",
        "Una mujer en la fila de una farmacia pagó mi receta cuando me rechazaron la tarjeta. Estaba demasiado avergonzada para darle las gracias. Pienso en ella.",
        "Un niño de unos diez años, en Italia, me dio una flor. No hablaba inglés. Lo he recordado durante cuarenta y seis años.",
      ],
    },
  },
  {
    id: 65,
    category: "values",
    depth: "depth",
    en: "What's something you do that goes against what most people would do, but you do anyway?",
    es: "¿Qué haces que va contra lo que la mayoría haría, pero lo haces de todos modos?",
    randomizeOptions: {
      en: [
        "Le digo a la cajera que se equivocó cuando me da más cambio. Always.",
        "I let people merge in front of me. All of them. I'm not in a rush.",
        "I say no to plans I don't want to be at. Even when it disappoints. I'm done saying yes from fear.",
        "I write letters by hand and post them. The young find it eccentric; I find it the only honest medium left.",
      ],
      es: [
        "Le digo a la cajera que se equivocó cuando me da cambio de más. Siempre.",
        "Dejo que la gente se meta enfrente. Todos. No tengo prisa.",
        "Digo que no a planes en los que no quiero estar. Aunque decepcione. Ya no digo sí por miedo.",
        "Escribo cartas a mano y las envío. Los jóvenes lo hallan excéntrico; yo lo encuentro el único medio honesto que queda.",
      ],
    },
  },
  {
    id: 66,
    category: "self",
    depth: "depth",
    en: "What part of yourself have you had to fight to protect?",
    es: "¿Qué parte de ti has tenido que pelear por proteger?",
    randomizeOptions: {
      en: [
        "Mi fe. Toda mi vida. People will try to take that. I don't let them.",
        "My patience with my kids. I was raised yelled at. I refused to do that. It cost me.",
        "My softness. The world rewards the opposite. I've kept it anyway.",
        "My capacity for wonder, which a long life and several disappointments have repeatedly conspired to dull.",
      ],
      es: [
        "Mi fe. Toda mi vida. La gente trata de quitártela. Yo no dejo.",
        "Mi paciencia con mis hijos. A mí me criaron a gritos. Me negué a hacer eso. Me costó.",
        "Mi suavidad. El mundo premia lo contrario. La he conservado igual.",
        "Mi capacidad de asombro, que una vida larga y varios desencantos han conspirado repetidamente para opacar.",
      ],
    },
  },
  {
    id: 67,
    category: "love",
    depth: "depth",
    en: "What's the truest thing you've ever said to someone, that took you a long time to say?",
    es: "¿Cuál es la cosa más verdadera que le has dicho a alguien, que te tomó mucho tiempo decir?",
    randomizeOptions: {
      en: [
        "Le dije a mi hijo que estaba orgullosa de él. The first time, he was forty-one. We both cried.",
        "Told my dad I forgave him. He didn't say anything. He nodded. That was a lot for him.",
        "Told my mom I loved her in a voicemail and meant it. We didn't really say it growing up.",
        "I told my wife, after sixteen years, that I had been the more fortunate of us. She has, with grace, declined to argue.",
      ],
      es: [
        "Le dije a mi hijo que estaba orgullosa de él. La primera vez tenía cuarenta y uno. Lloramos los dos.",
        "Le dije a mi papá que lo perdonaba. No dijo nada. Asintió. Eso era mucho para él.",
        "Le dije a mi mamá que la quería en un mensaje de voz y lo decía en serio. No lo decíamos mucho de niños.",
        "Le dije a mi esposa, después de dieciséis años, que yo había sido el más afortunado de los dos. Ella, con gracia, ha declinado discutirlo.",
      ],
    },
  },
  {
    id: 68,
    category: "self",
    depth: "depth",
    en: "What are you better at since you've gotten older?",
    es: "¿En qué eres mejor ahora que has crecido?",
    randomizeOptions: {
      en: [
        "Quedarme callada. No siempre tengo que ganar la conversación.",
        "Walking away from a fight that doesn't matter. Took me forty years.",
        "Knowing when to leave a room.",
        "I have, after seven decades, achieved some modest competence at not taking myself too seriously.",
      ],
      es: [
        "Quedarme callada. No siempre tengo que ganar la conversación.",
        "Irme de una pelea que no importa. Me tomó cuarenta años.",
        "Saber cuándo salir de un cuarto.",
        "He logrado, después de siete décadas, una modesta competencia en no tomarme demasiado en serio.",
      ],
    },
  },
  {
    id: 69,
    category: "advice",
    depth: "depth",
    en: "What do you tell young people that they almost never want to hear?",
    es: "¿Qué les dices a los jóvenes que casi nunca quieren oír?",
    randomizeOptions: {
      en: [
        "Que la familia se cuida. No la conveniencia, no los amigos, la familia. Aunque te haga falta.",
        "Most things you're scared of will turn out to be nothing. Most things you ignore will be everything.",
        "Your twenties are not a dress rehearsal. You're already in the play.",
        "That nearly all of one's worry is wasted on possibilities that do not arrive, and almost none on the small choices that quietly become a life.",
      ],
      es: [
        "Que la familia se cuida. No la conveniencia, no los amigos, la familia. Aunque te haga falta.",
        "Casi todo lo que te asusta resultará no ser nada. Casi todo lo que ignoras resultará serlo todo.",
        "Tus veintes no son un ensayo. Ya estás en la obra.",
        "Que casi toda la preocupación se gasta en posibilidades que no llegan, y casi ninguna en las decisiones pequeñas que silenciosamente se convierten en una vida.",
      ],
    },
  },
  {
    id: 70,
    category: "values",
    depth: "depth",
    en: "What do you believe that you cannot prove?",
    es: "¿Qué crees que no puedes probar?",
    randomizeOptions: {
      en: [
        "Que mi mami sigue cuidándome. No tengo prueba. Tengo certeza.",
        "Most people are doing the best they can with what they were given. I can't prove it. I act like it's true.",
        "That love changes the room before it's spoken.",
        "That a small private kindness alters something in the world we cannot measure but should not, on that account, dismiss.",
      ],
      es: [
        "Que mi mami sigue cuidándome. No tengo prueba. Tengo certeza.",
        "La mayoría de la gente hace lo mejor que puede con lo que le tocó. No lo puedo probar. Vivo como si fuera cierto.",
        "Que el amor cambia el cuarto antes de que se diga.",
        "Que una pequeña bondad privada altera algo en el mundo que no podemos medir pero que, por eso mismo, no deberíamos descartar.",
      ],
    },
  },
  {
    id: 71,
    category: "stories",
    depth: "depth",
    en: "What's a story you've told a hundred times because it tells the truth about you?",
    es: "¿Cuál es una historia que has contado cien veces porque dice la verdad sobre ti?",
    randomizeOptions: {
      en: [
        "La de la noche que perdí las llaves y mi vecino me ayudó a buscarlas en la lluvia. We were strangers at midnight, neighbors by morning.",
        "The one where my dad fixed a flat in twelve degrees with no gloves on. He didn't complain. That's the whole story.",
        "The one about the time I missed the train, met someone at the station, and ended up writing a poem I still know by heart.",
        "An afternoon, in 1964, when I rescued a bird and learned that small acts of attention determine who one becomes.",
      ],
      es: [
        "La de la noche que perdí las llaves y mi vecino me ayudó a buscarlas en la lluvia. Éramos desconocidos a medianoche, vecinos por la mañana.",
        "La de cuando mi papá arregló una llanta a doce grados sin guantes. No se quejó. Esa es toda la historia.",
        "La de cuando perdí el tren, conocí a alguien en la estación, y terminé escribiendo un poema que aún me sé de memoria.",
        "Una tarde, en 1964, cuando rescaté un pájaro y aprendí que los pequeños actos de atención determinan en quién uno se convierte.",
      ],
    },
  },
  {
    id: 72,
    category: "love",
    depth: "depth",
    en: "Who saw you clearly, before you did?",
    es: "¿Quién te vio con claridad antes que tú a ti mismo?",
    randomizeOptions: {
      en: [
        "Mi mami. Always. She knew I'd be okay before I did.",
        "My uncle Ray. Said I'd be a teacher. Took me twenty years to do it. He was right.",
        "A high school teacher. Wrote on a paper, \"You are paying attention.\" That's the line that turned me into a writer.",
        "My wife, three weeks into knowing me, predicted I would be insufferable but redeemable. She was right on both counts.",
      ],
      es: [
        "Mi mami. Siempre. Sabía que yo iba a estar bien antes que yo.",
        "Mi tío Ray. Dijo que sería maestro. Me tomó veinte años llegar a serlo. Tenía razón.",
        "Una maestra de la prepa. Me escribió en un trabajo: \"Estás prestando atención.\" Esa es la frase que me hizo escritor.",
        "Mi esposa, a las tres semanas de conocerme, predijo que sería insoportable pero redimible. Acertó en ambos puntos.",
      ],
    },
  },
  {
    id: 73,
    category: "values",
    depth: "depth",
    en: "What's something you used to want badly that you no longer want at all?",
    es: "¿Qué deseabas mucho antes que ya no deseas para nada?",
    randomizeOptions: {
      en: [
        "Que la gente me aprobara. Una pérdida de tiempo. Now I sleep.",
        "A bigger house. Bigger truck. Now I want a smaller life and more of it.",
        "To be the smartest person in the room. Now I want to be the warmest.",
        "Recognition in my field. The applause of strangers, I now suspect, is a poor substitute for the regard of those one shares a kitchen with.",
      ],
      es: [
        "Que la gente me aprobara. Una pérdida de tiempo. Ahora duermo.",
        "Una casa más grande. Camioneta más grande. Ahora quiero una vida más pequeña y más de ella.",
        "Ser la persona más inteligente del cuarto. Ahora quiero ser la más cálida.",
        "Reconocimiento en mi campo. El aplauso de los desconocidos, ahora sospecho, es un sustituto pobre del aprecio de aquellos con quienes se comparte la cocina.",
      ],
    },
  },
  {
    id: 74,
    category: "quiet",
    depth: "soul",
    en: "When have you most felt that something larger than you was paying attention?",
    es: "¿Cuándo has sentido más que algo más grande que tú estaba prestando atención?",
    randomizeOptions: {
      en: [
        "Bautizo de mi nieta. Sentí a mi mami en el cuarto. No estaba sola con eso.",
        "On a road, alone, after my old man died. Felt him in the truck. Couldn't tell you how I knew.",
        "Standing on a rocky beach in Maine when I was sixteen. The waves and I had the same name for a moment.",
        "Once, in 1974, in the silence after a Mahler symphony, I had the unmistakable impression that the universe was, briefly, listening back.",
      ],
      es: [
        "Bautizo de mi nieta. Sentí a mi mami en el cuarto. No estaba sola con eso.",
        "En una carretera, solo, después de que murió mi viejo. Lo sentí en la camioneta. No te puedo decir cómo lo supe.",
        "Parada en una playa rocosa de Maine a los dieciséis. Las olas y yo tuvimos por un momento el mismo nombre.",
        "Una vez, en 1974, en el silencio tras una sinfonía de Mahler, tuve la impresión inequívoca de que el universo, brevemente, escuchaba de vuelta.",
      ],
    },
  },
  {
    id: 75,
    category: "legacy",
    depth: "soul",
    en: "If a great-grandchild you'll never meet asked you one question, and you could answer with one true sentence, what would you tell them?",
    es: "Si un bisnieto que nunca conocerás te hiciera una pregunta, y pudieras responder con una sola oración verdadera, ¿qué le dirías?",
    randomizeOptions: {
      en: [
        "Que tu abuela cuyo nombre no recuerdas te quiso, sin haberte conocido. Eso basta.",
        "You came from people who showed up. Don't break the chain.",
        "The world is, much more than you suspect, what you make of it. Make something kind.",
        "That a life is built of small, quiet decisions, made when no one is watching, and that yours, however you spend it, will be one such accumulation.",
      ],
      es: [
        "Que tu abuela cuyo nombre no recuerdas te quiso, sin haberte conocido. Eso basta.",
        "Vienes de gente que aparecía. No rompas la cadena.",
        "El mundo es, mucho más de lo que sospechas, lo que tú haces de él. Haz algo amable.",
        "Que una vida se construye de pequeñas decisiones calladas, tomadas cuando nadie ve, y que la tuya, sea como sea que la gastes, será una de esas acumulaciones.",
      ],
    },
  },

  // — Batch 3 (76–85) — using tagged tone: 0 soft-female, 1 broish-male, 2 open-neutral, 3 male variant —
  {
    id: 76,
    category: "childhood",
    depth: "texture",
    en: "What's a food you couldn't stomach as a kid? Can you eat it now?",
    es: "¿Qué comida no soportabas de niño? ¿La comes ahora?",
    randomizeOptions: {
      en: [
        "El hígado de mami, el pobre. I'd hide it in my napkin. Now I'd eat anything she made me, just to have her cooking again.",
        "Mushrooms. Hated them. Still don't trust them.",
        "Tomatoes — the texture, mostly. I came around in my twenties and now I cook with them daily.",
        "Boiled cabbage. Can't say I've reconsidered.",
      ],
      es: [
        "El hígado de mami, el pobre. Lo escondía en la servilleta. Ahora me comería cualquier cosa que ella me hiciera, sólo por volver a probar su cocina.",
        "Champiñones. Los odiaba. Sigo sin confiar en ellos.",
        "Los tomates — la textura, sobre todo. Cambié de opinión en mis veintes y ahora cocino con ellos a diario.",
        "Repollo hervido. No puedo decir que haya cambiado de idea.",
      ],
    },
  },
  {
    id: 77,
    category: "stories",
    depth: "texture",
    en: "Tell me about a piece of clothing you ruined and never quite forgot.",
    es: "Cuéntame de una prenda que arruinaste y que nunca olvidaste.",
    randomizeOptions: {
      en: [
        "Un vestido amarillo de mi quinceañera. Got punch on it dancing. I cried. My mami cleaned it for an hour.",
        "Suit pants. Sat on a wet bench. Wore them to a wedding anyway.",
        "A cashmere sweater my friend lent me — coffee, ten minutes in. I bought her a better one, and she still brings it up.",
        "A varsity jacket. Lent it to a girl. Never saw it again. Saw the girl twice more.",
      ],
      es: [
        "Un vestido amarillo de mi quinceañera. Le cayó ponche bailando. Lloré. Mi mami lo limpió por una hora.",
        "Pantalones de traje. Me senté en una banca mojada. Fui a la boda con ellos igual.",
        "Un suéter de cashmere que me prestó mi amiga — café, a los diez minutos. Le compré uno mejor, y aún me lo recuerda.",
        "Una chaqueta del equipo. Se la presté a una muchacha. Nunca la volví a ver. A ella la vi dos veces más.",
      ],
    },
  },
  {
    id: 78,
    category: "stories",
    depth: "texture",
    en: "What's a time you bumped into someone you didn't expect, and where?",
    es: "¿Cuándo te encontraste con alguien que no esperabas, y dónde?",
    randomizeOptions: {
      en: [
        "Encontré a una vieja amiga del barrio en un hospital de Miami. Both there for our mothers. Lloramos en el pasillo.",
        "Saw my high school coach at a hardware store. Twenty years later. He didn't remember me. I didn't tell him.",
        "Ran into someone I'd dated five years prior at a bookstore in another city. We had coffee. It was lovely and final.",
        "An old army buddy. Gas station. Didn't speak. Nodded. He nodded back.",
      ],
      es: [
        "Encontré a una vieja amiga del barrio en un hospital de Miami. Las dos por nuestras madres. Lloramos en el pasillo.",
        "Vi a mi entrenador de la prepa en una ferretería. Veinte años después. No me reconoció. No le dije.",
        "Me crucé con alguien con quien había salido cinco años antes, en una librería de otra ciudad. Tomamos café. Fue hermoso y definitivo.",
        "Un compañero del ejército. Gasolinera. No hablamos. Nos saludamos con la cabeza. Él me devolvió el saludo.",
      ],
    },
  },
  {
    id: 79,
    category: "self",
    depth: "surface",
    en: "What's on your phone's home screen — wallpaper and all?",
    es: "¿Qué tienes en la pantalla de inicio del teléfono — fondo y todo?",
    randomizeOptions: {
      en: [
        "Una foto de mis nietos en la playa. The youngest is making a face. Me mata de la risa cada vez que lo veo.",
        "Plain black. Eight apps I actually use. That's it.",
        "A photo of fog over a hill, taken on a Tuesday I needed. I look at it more than I should.",
        "Picture of my dog. He's been gone six years. Don't see a reason to change it.",
      ],
      es: [
        "Una foto de mis nietos en la playa. El más chiquito hace una mueca. Me mata de la risa cada vez que la veo.",
        "Negro sólido. Ocho apps que uso. Nada más.",
        "Una foto de niebla sobre una colina, tomada un martes que la necesitaba. La miro más de lo que debería.",
        "Foto de mi perro. Se fue hace seis años. No veo razón para cambiarla.",
      ],
    },
  },
  {
    id: 80,
    category: "childhood",
    depth: "texture",
    en: "How did your house go quiet at night when you were a kid?",
    es: "¿Cómo se ponía tranquila tu casa de noche cuando eras niño?",
    randomizeOptions: {
      en: [
        "Mami dejaba la radio bajita en la cocina hasta que se quedaba dormida. That low murmur was the lullaby of my whole childhood.",
        "Old man fell asleep with the TV on. Mom got up and turned it off. Same thing every night.",
        "It went quiet in stages — dishes, then footsteps, then a door, then the house breathing. I learned each layer.",
        "The grandfather clock kept time. Everything else stopped. We lived inside that ticking.",
      ],
      es: [
        "Mami dejaba la radio bajita en la cocina hasta que se quedaba dormida. Ese murmullo bajito fue la canción de cuna de mi infancia entera.",
        "Mi viejo se dormía con la tele puesta. Mi mamá se levantaba y la apagaba. La misma rutina cada noche.",
        "Se ponía tranquila por etapas — los platos, luego los pasos, luego una puerta, luego la respiración de la casa. Aprendí cada capa.",
        "El reloj de pie marcaba el tiempo. Todo lo demás se detenía. Vivíamos adentro de ese tic-tac.",
      ],
    },
  },
  {
    id: 81,
    category: "family",
    depth: "texture",
    en: "Was there an aunt, uncle, or cousin who quietly shaped who you are?",
    es: "¿Hubo una tía, un tío o un primo que en silencio te moldeó?",
    randomizeOptions: {
      en: [
        "Mi tía Yolanda. She had no kids. She had me. Me llevaba al cine y me decía que yo iba a ser alguien.",
        "My uncle Ray. Showed me how to fix a carburetor and shut up while doing it. Both useful.",
        "An older cousin who lent me her books and never asked for them back. I owe my reading life to her.",
        "Uncle Walt. Drank too much, told the truth. I learned both lessons.",
      ],
      es: [
        "Mi tía Yolanda. No tenía hijos. Me tenía a mí. Me llevaba al cine y me decía que yo iba a ser alguien.",
        "Mi tío Ray. Me enseñó a arreglar un carburador y a callarme mientras lo hacía. Ambas cosas útiles.",
        "Una prima mayor que me prestaba sus libros y nunca me los pidió de vuelta. Le debo mi vida lectora.",
        "El tío Walt. Tomaba mucho, decía la verdad. Aprendí las dos lecciones.",
      ],
    },
  },
  {
    id: 82,
    category: "love",
    depth: "texture",
    en: "What's a small gesture you do for someone you love that they may not even notice?",
    es: "¿Cuál es un gesto pequeño que haces por alguien que amas y que tal vez ni nota?",
    randomizeOptions: {
      en: [
        "Le dejo el último pedacito de pastel. Sin decirle. Ella nunca lo ha mencionado, pero yo sé que ella sabe.",
        "Top off her coffee before she notices it's low. Done it for fifteen years. Plan to keep doing it.",
        "I leave little notes in his coat pockets. Mostly nonsense. Sometimes he finds them weeks later.",
        "Warm her car up in winter. She thinks the engine just runs warm.",
      ],
      es: [
        "Le dejo el último pedacito de pastel. Sin decirle. Ella nunca lo ha mencionado, pero yo sé que ella sabe.",
        "Le sirvo más café antes de que se dé cuenta de que se le acabó. Quince años haciéndolo. Pienso seguir.",
        "Le dejo notitas en los bolsillos del abrigo. Casi siempre tonterías. A veces las encuentra semanas después.",
        "Le caliento el carro en invierno. Cree que el motor calienta rápido.",
      ],
    },
  },
  {
    id: 83,
    category: "stories",
    depth: "texture",
    en: "Tell me about a time you got really lost — actually or otherwise.",
    es: "Cuéntame de cuando te perdiste de verdad — literal o no.",
    randomizeOptions: {
      en: [
        "En La Habana, a los diecinueve. Sin mapa. Sin teléfono. Encontré un parque, me senté, me eché a llorar. Y un viejito me trajo un café.",
        "Took a wrong exit in Wyoming. Drove an hour. Saw a moose. Worth it.",
        "Lost in a city I'd lived in for two years. Couldn't find my own street. The day was full of those small undoings.",
        "Got turned around in a hospital. Wandered into a wing I shouldn't have. Saw something I haven't shaken.",
      ],
      es: [
        "En La Habana, a los diecinueve. Sin mapa. Sin teléfono. Encontré un parque, me senté, me eché a llorar. Y un viejito me trajo un café.",
        "Tomé la salida equivocada en Wyoming. Manejé una hora. Vi un alce. Valió la pena.",
        "Perdido en una ciudad en la que había vivido dos años. No encontraba mi propia calle. El día estuvo lleno de esos pequeños desbarajustes.",
        "Me confundí en un hospital. Caminé a un ala donde no debía estar. Vi algo que no se me ha quitado.",
      ],
    },
  },
  {
    id: 84,
    category: "self",
    depth: "surface",
    en: "What's on your nightstand right now?",
    es: "¿Qué hay en tu mesita de noche ahora mismo?",
    randomizeOptions: {
      en: [
        "Mi rosario, un vaso de agua, las gotas para los ojos, y una foto de Hector. En ese orden.",
        "Glasses, alarm clock, half a glass of water from three days ago.",
        "A book, a candle, a pile of receipts I keep meaning to deal with, a glass of water.",
        "A wristwatch, a worn paperback, and a single aspirin in case the night requires it.",
      ],
      es: [
        "Mi rosario, un vaso de agua, las gotas para los ojos, y una foto de Hector. En ese orden.",
        "Anteojos, reloj despertador, medio vaso de agua de hace tres días.",
        "Un libro, una vela, una pila de recibos que llevo tiempo queriendo organizar, un vaso de agua.",
        "Un reloj de pulsera, un libro de bolsillo gastado, y una aspirina por si la noche la requiere.",
      ],
    },
  },
  {
    id: 85,
    category: "childhood",
    depth: "texture",
    en: "What's a smell from school that comes back to you out of nowhere?",
    es: "¿Qué olor de la escuela te regresa de la nada?",
    randomizeOptions: {
      en: [
        "Tiza y cera del piso. Y sopa del comedor. Cuando lo huelo, tengo siete años y estoy formada en fila.",
        "Gym mats. Sweat and rubber. Hits me at random and I am twelve again.",
        "The mimeograph machine — that wet, blue, alcohol smell. Anyone under fifty doesn't know what I'm talking about, and that's part of the smell.",
        "Locker room. Soap and old metal. I smell it in hardware stores sometimes and freeze.",
      ],
      es: [
        "Tiza y cera del piso. Y sopa del comedor. Cuando lo huelo, tengo siete años y estoy formada en fila.",
        "Las colchonetas del gimnasio. Sudor y goma. Me llega de la nada y vuelvo a tener doce.",
        "La copiadora de mimeógrafo — ese olor mojado, azul, a alcohol. Nadie menor de cincuenta sabe de qué hablo, y eso es parte del olor.",
        "El vestidor. Jabón y metal viejo. A veces lo huelo en las ferreterías y me quedo paralizado.",
      ],
    },
  },

  // — Batch 4 (86–115) —
  {
    id: 86,
    category: "self",
    depth: "texture",
    en: "Is there a part of your body you're complicated about — that you've made peace with, or haven't?",
    es: "¿Hay una parte de tu cuerpo con la que tienes una historia complicada — con la que hiciste paces, o no?",
    randomizeOptions: {
      en: [
        "Mis manos. Manchas, arrugas. Antes me daban pena. Ahora pienso que son las manos que cargaron a mis nietos.",
        "My gut. Had it my whole life. Done worrying about it.",
        "My back, where the surgery was. I've stopped hating the scar; it earned its place.",
        "The shoulders. They have done the work. They have, on occasion, also done the worrying.",
      ],
      es: [
        "Mis manos. Manchas, arrugas. Antes me daban pena. Ahora pienso que son las manos que cargaron a mis nietos.",
        "La panza. La tengo de toda la vida. Ya no me preocupa.",
        "La espalda, donde fue la cirugía. Dejé de odiar la cicatriz; se la ganó.",
        "Los hombros. Han hecho el trabajo. Y, de vez en cuando, también la preocupación.",
      ],
    },
  },
  {
    id: 87,
    category: "love",
    depth: "texture",
    en: "Tell me about the first time someone broke your heart.",
    es: "Cuéntame de la primera vez que alguien te rompió el corazón.",
    randomizeOptions: {
      en: [
        "A los dieciocho. Se llamaba Tomás. Me dijo que no me amaba un domingo en la tarde y caminé a la iglesia y me senté.",
        "Junior year. She left for someone older. Smoked half a pack on the steps. Got over it.",
        "Sixteen. We were each other's first everything. The breakup was clean and devastating in the way only sixteen knows.",
        "The summer of 1962. Her name doesn't matter now; the lesson, however, does.",
      ],
      es: [
        "A los dieciocho. Se llamaba Tomás. Me dijo que no me amaba un domingo en la tarde y caminé a la iglesia y me senté.",
        "Tercer año de prepa. Se fue con uno mayor. Fumé medio paquete en las escaleras. Lo superé.",
        "Dieciséis. Éramos los primeros de todo el uno para el otro. La ruptura fue limpia y devastadora como sólo a los dieciséis se sabe.",
        "El verano de 1962. Su nombre ya no importa; la lección, sin embargo, sí.",
      ],
    },
  },
  {
    id: 88,
    category: "values",
    depth: "depth",
    en: "Tell me about a time you didn't have enough money. What did you learn?",
    es: "Cuéntame de una época sin suficiente dinero. ¿Qué aprendiste?",
    randomizeOptions: {
      en: [
        "El primer año en Miami, comíamos arroz con huevo cinco días por semana. Aprendí que el hambre se aguanta. Y que la dignidad se cuida.",
        "Twenty-two, three weeks of ramen. Learned to make a pot of beans last a week. Still do it sometimes.",
        "The year between jobs. Lived on rice and pride. I learned that the people who stay are the ones to keep.",
        "A year in graduate school during which the rent and the heat were a daily negotiation. I learned what I could, in fact, do without.",
      ],
      es: [
        "El primer año en Miami, comíamos arroz con huevo cinco días a la semana. Aprendí que el hambre se aguanta. Y que la dignidad se cuida.",
        "A los veintidós, tres semanas de fideos. Aprendí a hacer rendir una olla de frijoles toda la semana. Todavía lo hago.",
        "El año entre trabajos. Vivía de arroz y orgullo. Aprendí que los que se quedan son a los que hay que conservar.",
        "Un año en el posgrado en que la renta y la calefacción eran una negociación diaria. Aprendí, en efecto, de qué podía prescindir.",
      ],
    },
  },
  {
    id: 89,
    category: "stories",
    depth: "texture",
    en: "Where were you the first time you were kissed?",
    es: "¿Dónde estabas la primera vez que te besaron?",
    randomizeOptions: {
      en: [
        "Detrás de la iglesia. Quince años. Me asusté. El muchacho se asustó. Nos quedamos parados sin decirnos nada.",
        "Behind a Buick at a drive-in. Cherry Coke involved. Lasted three seconds.",
        "On a fire escape, at sixteen. Cold metal. Warm someone. I have not forgotten the contrast.",
        "On a porch, in 1959, after a town dance. The night was warm. I have, periodically, wished to return.",
      ],
      es: [
        "Detrás de la iglesia. Quince años. Me asusté. El muchacho se asustó. Nos quedamos parados sin decirnos nada.",
        "Atrás de un Buick en un autocine. Había Cherry Coke. Duró tres segundos.",
        "En una escalera de incendios, a los dieciséis. Metal frío. Alguien tibio. No he olvidado el contraste.",
        "En un porche, en 1959, después de un baile del pueblo. La noche era cálida. He querido, periódicamente, volver.",
      ],
    },
  },
  {
    id: 90,
    category: "love",
    depth: "texture",
    en: "Was there a pet who loved you back, the way only an animal can?",
    es: "¿Hubo un animal que te quisiera de la forma en que sólo un animal puede querer?",
    randomizeOptions: {
      en: [
        "Mi perrita, Chiquita. Vivió diecisiete años. Lloró cuando murió Hector más que yo.",
        "Old yellow dog named Rusty. Followed me everywhere. Buried him out back.",
        "A black cat named Olive. She chose me at the shelter and we never argued about it.",
        "A retriever named Beauford. He read me as one reads a book one already loves.",
      ],
      es: [
        "Mi perrita, Chiquita. Vivió diecisiete años. Lloró cuando murió Hector más que yo.",
        "Un perro amarillo viejo llamado Rusty. Me seguía a todos lados. Lo enterré atrás.",
        "Una gata negra que se llamaba Olive. Me eligió en el refugio y nunca lo discutimos.",
        "Un perdiguero llamado Beauford. Me leía como uno lee un libro que ya ama.",
      ],
    },
  },
  {
    id: 91,
    category: "place",
    depth: "texture",
    en: "What's a place you went to that surprised you — for better or worse?",
    es: "¿Qué lugar visitaste que te sorprendió — para bien o para mal?",
    randomizeOptions: {
      en: [
        "Nueva York en invierno. Pensé que iba a odiarlo. Me enamoré de los olores en la calle.",
        "New Orleans. Hot, loud, weird, perfect.",
        "A small town in Iceland. A week with the wrong jacket and the right book. I left changed.",
        "Florence in late November. Few tourists. Empty cathedrals. I have, since, advocated for the off-season.",
      ],
      es: [
        "Nueva York en invierno. Pensé que iba a odiarlo. Me enamoré de los olores en la calle.",
        "Nueva Orleans. Caliente, ruidosa, rara, perfecta.",
        "Un pueblito en Islandia. Una semana con la chaqueta equivocada y el libro correcto. Me fui cambiada.",
        "Florencia a finales de noviembre. Pocos turistas. Catedrales vacías. He defendido, desde entonces, la temporada baja.",
      ],
    },
  },
  {
    id: 92,
    category: "love",
    depth: "texture",
    en: "What was the name of your first real love? What were they like?",
    es: "¿Cómo se llamaba tu primer amor de verdad? ¿Cómo era?",
    randomizeOptions: {
      en: [
        "Hector. Tranquilo, paciente, leal. He hummed under his breath when he was thinking.",
        "Donna. Loud laugh. Could fix anything. Married a friend of mine. We're all still friends.",
        "His name was Marco. He read more than I did and wore his hair longer than my mother liked.",
        "Eleanor, who I met in 1958. She was kind in the unstaged way some people are. We did not last; she was, regardless, formative.",
      ],
      es: [
        "Hector. Tranquilo, paciente, leal. Tarareaba en voz baja cuando pensaba.",
        "Donna. Risa fuerte. Podía arreglar cualquier cosa. Se casó con un amigo mío. Aún somos todos amigos.",
        "Se llamaba Marco. Leía más que yo y traía el pelo más largo de lo que le gustaba a mi madre.",
        "Eleanor, a quien conocí en 1958. Era amable de una manera no actuada. No duramos; sin embargo, fue formativa.",
      ],
    },
  },
  {
    id: 93,
    category: "stories",
    depth: "texture",
    en: "Was there a game — sport, card, board, anything — that mattered to you?",
    es: "¿Hubo un juego — deporte, cartas, tablero, lo que sea — que te importaba?",
    randomizeOptions: {
      en: [
        "El dominó con mi papá los domingos. Yo perdía y él se reía. Daría algo por una partida más.",
        "Pickup baseball. Empty lot. Whoever showed up played. Best summers I had.",
        "Chess, badly, with my older sister. I lost most of the time and learned to love losing carefully.",
        "Bridge. Wednesday nights for forty years. We have lost two players to time and continued, in their honor, to deal them in.",
      ],
      es: [
        "El dominó con mi papá los domingos. Yo perdía y él se reía. Daría algo por una partida más.",
        "Béisbol callejero. Lote vacío. El que llegaba, jugaba. Los mejores veranos que tuve.",
        "Ajedrez, mal, con mi hermana mayor. Perdía la mayoría del tiempo y aprendí a perder con cuidado.",
        "Bridge. Miércoles por la noche durante cuarenta años. Hemos perdido a dos jugadores con el tiempo y, en su honor, seguimos repartiéndoles las cartas.",
      ],
    },
  },
  {
    id: 94,
    category: "stories",
    depth: "depth",
    en: "What's the first book that wrecked you?",
    es: "¿Cuál es el primer libro que te destrozó?",
    randomizeOptions: {
      en: [
        "Cien años de soledad. Tenía veinticuatro años. No dormí dos días.",
        "The Old Man and the Sea. Tenth grade. Closed the book and didn't talk for an hour.",
        "Their Eyes Were Watching God. I read it on a bus. Missed my stop. Walked back changed.",
        "Death of Ivan Ilyich. Twenty-one years old. I have, since, been unable to think of the dying without thinking of Tolstoy.",
      ],
      es: [
        "Cien años de soledad. Tenía veinticuatro años. No dormí dos días.",
        "El viejo y el mar. Décimo grado. Cerré el libro y no hablé por una hora.",
        "Their Eyes Were Watching God. Lo leí en un autobús. Me pasé de mi parada. Regresé cambiada.",
        "La muerte de Iván Ilich. A los veintiuno. Desde entonces, no he podido pensar en los moribundos sin pensar en Tolstói.",
      ],
    },
  },
  {
    id: 95,
    category: "self",
    depth: "texture",
    en: "What's a movie you've watched too many times? What about it keeps pulling you back?",
    es: "¿Qué película has visto demasiadas veces? ¿Qué te hace volver a ella?",
    randomizeOptions: {
      en: [
        "Fresa y Chocolate. La he visto en cada mood que existe. Cada vez veo algo nuevo.",
        "Goodfellas. Yeah I know. The diner scene. That's all you need.",
        "Lost in Translation. I rewatch it when I'm lonely. It doesn't fix it. It honors it.",
        "Casablanca. The lighting. The silences. Everything one ever needs to know about sacrifice is in that film.",
      ],
      es: [
        "Fresa y Chocolate. La he visto en cada estado de ánimo que existe. Cada vez veo algo nuevo.",
        "Goodfellas. Sí, ya sé. La escena del comedor. Con eso basta.",
        "Lost in Translation. La vuelvo a ver cuando estoy sola. No me cura. Le hace honor.",
        "Casablanca. La iluminación. Los silencios. Todo lo que uno necesita saber sobre el sacrificio está en esa película.",
      ],
    },
  },
  {
    id: 96,
    category: "family",
    depth: "depth",
    en: "What's something only your siblings know about you?",
    es: "¿Qué saben de ti sólo tus hermanos?",
    randomizeOptions: {
      en: [
        "Que le tenía miedo a los baños a oscuras hasta los catorce. Mi hermana se reía pero me esperaba afuera.",
        "How scared I was of dad. They knew without me ever saying it.",
        "That I cried at the end of every movie, even comedies, all through middle school. They never told anyone.",
        "The exact location of a particular juvenile crime, the statute of limitations on which has, blessedly, expired.",
      ],
      es: [
        "Que le tenía miedo a los baños a oscuras hasta los catorce. Mi hermana se reía pero me esperaba afuera.",
        "Lo asustada que estaba de papá. Lo sabían sin que yo lo dijera.",
        "Que lloraba al final de cada película, hasta las comedias, durante toda la secundaria. Nunca le dijeron a nadie.",
        "La ubicación exacta de un delito juvenil cuya prescripción, bendito sea, ya pasó.",
      ],
    },
  },
  {
    id: 97,
    category: "work",
    depth: "texture",
    en: "What's something you can do with your hands that you're quietly proud of?",
    es: "¿Qué cosa sabes hacer con las manos de la que estás silenciosamente orgulloso?",
    randomizeOptions: {
      en: [
        "Tejo. Bufandas, gorritos, manteles. Mis nietos los llevan al colegio.",
        "Rebuild a small block by myself. Don't talk about it. Just do it.",
        "I can fold a fitted sheet in under ninety seconds. It is the only domestic skill I have ever fully mastered.",
        "I bind books, by hand, with proper tools. The result is, on a good day, the work of an amateur with patience.",
      ],
      es: [
        "Tejo. Bufandas, gorritos, manteles. Mis nietos los llevan al colegio.",
        "Reconstruyo un block chico yo solo. No lo platico. Sólo lo hago.",
        "Puedo doblar una sábana ajustable en menos de noventa segundos. Es la única habilidad doméstica que he dominado por completo.",
        "Encuaderno libros, a mano, con herramientas apropiadas. El resultado es, en un buen día, el trabajo de un aficionado con paciencia.",
      ],
    },
  },
  {
    id: 98,
    category: "family",
    depth: "depth",
    en: "What's the first funeral you remember? What stayed with you?",
    es: "¿Cuál es el primer funeral que recuerdas? ¿Qué se te quedó?",
    randomizeOptions: {
      en: [
        "El de mi tío Pepe. Tenía nueve años. Lo que recuerdo: el olor de las flores y a mi mami sosteniéndome la mano.",
        "Grandpa's. I was seven. What stayed: my dad cried and I'd never seen that.",
        "An aunt's. I was twelve. The way the adults touched each other gently — that's what I remember.",
        "My grandfather's. The thing that stayed was a stranger's hand on my shoulder, and the unexpected fact of being known.",
      ],
      es: [
        "El de mi tío Pepe. Tenía nueve años. Lo que recuerdo: el olor de las flores y a mi mami agarrándome la mano.",
        "El de mi abuelo. Tenía siete. Lo que se quedó: mi papá lloró y yo nunca lo había visto.",
        "El de una tía. Tenía doce. La forma en que los adultos se tocaban suavemente — eso recuerdo.",
        "El de mi abuelo. Lo que se quedó fue la mano de un desconocido sobre mi hombro, y el hecho inesperado de ser conocido.",
      ],
    },
  },
  {
    id: 99,
    category: "family",
    depth: "texture",
    en: "How did your family handle the holidays? Tell me one specific thing.",
    es: "¿Cómo era una fiesta en tu familia? Dime una cosa específica.",
    randomizeOptions: {
      en: [
        "Nochebuena. Lechón en el patio. Música hasta las cuatro de la mañana. Yo bailaba con mi tío hasta caerme.",
        "Christmas Eve at midnight. Mom would set out shrimp and let us stay up. That was the whole tradition.",
        "Thanksgiving was small and tense. We learned, eventually, to bring a deck of cards.",
        "Christmas dinner involved a great deal of silver and a great deal of quiet, and a turkey we never quite finished.",
      ],
      es: [
        "Nochebuena. Lechón en el patio. Música hasta las cuatro de la mañana. Yo bailaba con mi tío hasta caerme.",
        "La víspera de Navidad a medianoche. Mamá ponía camarones y nos dejaba quedarnos despiertos. Esa era toda la tradición.",
        "El Día de Acción de Gracias era pequeño y tenso. Aprendimos, con el tiempo, a llevar un mazo de cartas.",
        "La cena de Navidad involucraba mucha plata y mucho silencio, y un pavo que nunca terminábamos del todo.",
      ],
    },
  },
  {
    id: 100,
    category: "stories",
    depth: "depth",
    en: "Is there a photograph you can't quite bring yourself to look at?",
    es: "¿Hay alguna foto que no te animas del todo a mirar?",
    randomizeOptions: {
      en: [
        "La última de Hector, la víspera del hospital. La tengo. La veo de reojo. No de frente, todavía.",
        "Last picture of dad. Doesn't matter how long it's been. Skip past it.",
        "One of me at twenty-three. Somebody else's smile. I don't quite recognize who I was that year.",
        "An image of my late brother, taken on a bridge in 1967. I have not, in many years, looked directly at it.",
      ],
      es: [
        "La última de Hector, la víspera del hospital. La tengo. La veo de reojo. No de frente, todavía.",
        "La última foto de papá. No importa cuánto tiempo haya pasado. Me la salto.",
        "Una mía a los veintitrés. Sonrisa de otra persona. No reconozco del todo quién era ese año.",
        "Una imagen de mi hermano fallecido, tomada en un puente en 1967. No la he mirado, en muchos años, directamente.",
      ],
    },
  },
  {
    id: 101,
    category: "values",
    depth: "soul",
    en: "Do you pray? If so, to what — and what do you say?",
    es: "¿Rezas? Si sí, ¿a quién — y qué dices?",
    randomizeOptions: {
      en: [
        "Sí. Al Dios de mi mami, al de mi abuela. Le pido por mis nietos y le doy gracias por estar todavía aquí.",
        "Yeah. Don't make a thing of it. Mostly thanks. Sometimes please.",
        "I pray, in the loosest sense, to a kindness I can't name. The words are usually \"thank you\" and \"please be gentle.\"",
        "I converse, after a fashion, with whatever is listening. The vocabulary is largely gratitude. The frequency, daily.",
      ],
      es: [
        "Sí. Al Dios de mi mami, al de mi abuela. Le pido por mis nietos y le doy gracias por seguir aquí.",
        "Sí. No hago un escándalo. Casi siempre gracias. A veces por favor.",
        "Rezo, en el sentido más flexible, a una bondad que no sé nombrar. Las palabras suelen ser \"gracias\" y \"sé suave.\"",
        "Converso, a mi manera, con lo que esté escuchando. El vocabulario es, en gran parte, gratitud. La frecuencia, diaria.",
      ],
    },
  },
  {
    id: 102,
    category: "stories",
    depth: "depth",
    en: "Tell me about a failure that turned out, eventually, to be a gift.",
    es: "Cuéntame de un fracaso que con el tiempo resultó ser un regalo.",
    randomizeOptions: {
      en: [
        "Que Hector y yo perdiéramos el primer negocio. Nos hizo más unidos. Sin esa quiebra no hubiéramos durado.",
        "Got fired in '95. Worst year of my life. Best thing that happened to me.",
        "Didn't get into the school I wanted. Went somewhere smaller. Met the people who became my life.",
        "I was, with vigor, denied a particular promotion. The disappointment, in time, became the doorway to the work I was actually meant to do.",
      ],
      es: [
        "Que Hector y yo perdiéramos el primer negocio. Nos hizo más unidos. Sin esa quiebra no hubiéramos durado.",
        "Me corrieron en el 95. El peor año de mi vida. Lo mejor que me pasó.",
        "No entré a la escuela que quería. Fui a una más chica. Conocí a la gente que se volvió mi vida.",
        "Me negaron, con vigor, un ascenso particular. El desencanto, con el tiempo, se volvió la puerta al trabajo que en realidad debía hacer.",
      ],
    },
  },
  {
    id: 103,
    category: "self",
    depth: "depth",
    en: "What does your body remember that your mind has half-forgotten?",
    es: "¿Qué recuerda tu cuerpo que tu mente ha medio olvidado?",
    randomizeOptions: {
      en: [
        "El piano de mi mami. Mis dedos saben canciones que mi cabeza no.",
        "How to box. Don't ask. Hands still know.",
        "The shape of an old apartment. I find myself, mid-step, reaching for a light switch that hasn't been there in twelve years.",
        "The drill of a particular military exercise. The mind has, mercifully, forgotten the rationale; the body has not forgotten the motion.",
      ],
      es: [
        "El piano de mi mami. Mis dedos se saben canciones que mi cabeza no.",
        "Cómo boxear. No preguntes. Las manos todavía saben.",
        "La forma de un apartamento viejo. Me encuentro, a media zancada, buscando un apagador que no ha estado ahí en doce años.",
        "El movimiento de un ejercicio militar particular. La mente, misericordiosamente, ha olvidado la razón; el cuerpo no ha olvidado el movimiento.",
      ],
    },
  },
  {
    id: 104,
    category: "love",
    depth: "depth",
    en: "Tell me about a time someone betrayed you. Did you forgive them, fully?",
    es: "Cuéntame de cuando alguien te traicionó. ¿Lo perdonaste de verdad?",
    randomizeOptions: {
      en: [
        "Una amiga le contó a mi marido un secreto que era mío. Tardé años. Sí, la perdoné. No volví a contarle nada.",
        "Buddy slept with my girlfriend in '98. Forgave him. Don't see him.",
        "A close friend repeated a private grief at a dinner. I forgave him in word but the trust never returned to its original shape.",
        "A colleague claimed credit. I forgave it; I did not forget it; I have not, in the years since, been undone by it.",
      ],
      es: [
        "Una amiga le contó a mi marido un secreto que era mío. Tardé años. Sí, la perdoné. No le volví a contar nada.",
        "Un cuate se acostó con mi novia en el 98. Lo perdoné. No lo veo.",
        "Un amigo cercano repitió un duelo privado en una cena. Lo perdoné de palabra pero la confianza no volvió a su forma original.",
        "Un colega se atribuyó el crédito. Lo perdoné; no lo olvidé; en los años siguientes, no me ha deshecho.",
      ],
    },
  },
  {
    id: 105,
    category: "self",
    depth: "depth",
    en: "Who have you envied, even for a flicker, and what did you envy?",
    es: "¿A quién has envidiado, aunque sea un instante, y qué le envidiaste?",
    randomizeOptions: {
      en: [
        "A mi prima Yoli. Tenía menos miedo que yo. Caminaba por la vida como si nada pudiera tocarla.",
        "A guy I knew in high school. Got everything easy. Still does. Still envy him sometimes.",
        "A friend whose mother lived to ninety-three. I envied the years she had. Then I let it go.",
        "A colleague whose work, at fifty, was the best of his career. I have, on more than one occasion, envied his timing.",
      ],
      es: [
        "A mi prima Yoli. Le tenía menos miedo a la vida que yo. Caminaba por el mundo como si nada pudiera tocarla.",
        "Un tipo que conocí en la prepa. Todo le salía fácil. Aún. Aún lo envidio a veces.",
        "Una amiga cuya madre vivió hasta los noventa y tres. Envidié los años que tuvo. Luego lo solté.",
        "Un colega cuyo trabajo, a los cincuenta, fue lo mejor de su carrera. He envidiado, en más de una ocasión, su sentido del tiempo.",
      ],
    },
  },
  {
    id: 106,
    category: "self",
    depth: "depth",
    en: "Tell me about a time you really lost your temper. How did it land?",
    es: "Cuéntame de cuando perdiste los estribos de verdad. ¿Cómo terminó?",
    randomizeOptions: {
      en: [
        "Le grité a mi hijo cuando tenía diecisiete. Vi su cara y supe que había roto algo. Llamé esa misma noche para pedir perdón.",
        "Threw a wrench at the wall once. Wall lost. So did I.",
        "Yelled at a customer service rep over something that wasn't her fault. Hung up and felt small for a week.",
        "I lost it, once, in 1981, at a faculty meeting. I have, since, been a man who waits.",
      ],
      es: [
        "Le grité a mi hijo cuando tenía diecisiete. Le vi la cara y supe que había roto algo. Esa misma noche le pedí perdón.",
        "Una vez aventé una llave contra la pared. La pared perdió. Yo también.",
        "Le grité a una representante de servicio al cliente por algo que no era su culpa. Colgué y me sentí pequeña una semana.",
        "Perdí el control, una vez, en 1981, en una junta del profesorado. He sido, desde entonces, un hombre que espera.",
      ],
    },
  },
  {
    id: 107,
    category: "values",
    depth: "depth",
    en: "What's a secret you've kept that you intend to keep forever?",
    es: "¿Cuál es un secreto que has guardado y piensas guardar para siempre?",
    randomizeOptions: {
      en: [
        "Algo que me dijo mi hermana antes de morir. No es para nadie más. Y así se queda.",
        "A friend's. Not my secret to give up. Won't.",
        "A thing my mother told me at the end of her life that I cannot say without unsettling people who don't need to be unsettled.",
        "A piece of family history I inherited and intend to take, as the saying goes, to the grave.",
      ],
      es: [
        "Algo que me dijo mi hermana antes de morir. No es para nadie más. Y así se queda.",
        "Uno de un amigo. No es mío para soltarlo. No.",
        "Algo que me dijo mi madre al final de su vida que no puedo decir sin perturbar a personas que no necesitan ser perturbadas.",
        "Una pieza de historia familiar que heredé y pienso, como dicen, llevarme a la tumba.",
      ],
    },
  },
  {
    id: 108,
    category: "work",
    depth: "depth",
    en: "What was the worst job you ever had, and what did you take from it?",
    es: "¿Cuál fue el peor trabajo que tuviste, y qué te llevaste de él?",
    randomizeOptions: {
      en: [
        "Limpiando un hotel donde el dueño nos hablaba mal. Aprendí que ni la pobreza te obliga a aguantar un mal hombre. Me fui.",
        "Worked the line at a meat plant. One summer. Taught me to never confuse a job with a life.",
        "A retail manager who was cruel for sport. Two years. I learned what kind of boss I refused to become.",
        "A clerkship under a man of small character and large title. I learned, principally, how not to wield authority.",
      ],
      es: [
        "Limpiando un hotel donde el dueño nos hablaba mal. Aprendí que ni la pobreza te obliga a aguantar a un mal hombre. Me fui.",
        "Trabajé en la línea de una procesadora de carne. Un verano. Me enseñó a no confundir un trabajo con una vida.",
        "Una gerente de tienda que era cruel por deporte. Dos años. Aprendí qué tipo de jefa me negaba a ser.",
        "Un puesto de ayudante bajo un hombre de carácter pequeño y título grande. Aprendí, principalmente, cómo no ejercer la autoridad.",
      ],
    },
  },
  {
    id: 109,
    category: "advice",
    depth: "depth",
    en: "What's the best piece of advice you ever got, and from whom?",
    es: "¿Cuál es el mejor consejo que recibiste, y de quién?",
    randomizeOptions: {
      en: [
        "Mi mami: \"Nadie va a venir a salvarte. Sálvate tú, y después ayuda al que venga atrás.\"",
        "Old man: \"Don't argue with stupid people. They'll drag you down to their level and beat you with experience.\"",
        "A mentor told me, \"Most things you're scared of are not as big as the regret of not trying.\" I think about it weekly.",
        "A retired colleague, on my fortieth birthday, said, \"Choose the work that makes you a better person. Money will be sufficient.\" He was correct.",
      ],
      es: [
        "Mi mami: \"Nadie va a venir a salvarte. Sálvate tú, y después ayuda al que venga atrás.\"",
        "Mi viejo: \"No discutas con tontos. Te arrastran a su nivel y te ganan por experiencia.\"",
        "Una mentora me dijo: \"Casi todo lo que te asusta no es tan grande como el arrepentimiento de no intentarlo.\" Pienso en eso cada semana.",
        "Un colega jubilado, en mi cumpleaños número cuarenta, me dijo: \"Escoge el trabajo que te haga mejor persona. El dinero será suficiente.\" Tenía razón.",
      ],
    },
  },
  {
    id: 110,
    category: "values",
    depth: "depth",
    en: "What's an opinion you held strongly that you've completely reversed?",
    es: "¿Qué opinión sostuviste con fuerza que cambiaste por completo?",
    randomizeOptions: {
      en: [
        "Que el divorcio era una falla. Mi hija se divorció y entendí que a veces es lo más sagrado que se puede hacer.",
        "Used to think therapy was for soft people. Therapy saved my marriage.",
        "I used to believe forgiveness required understanding the offender. I no longer do; sometimes one forgives in the absence of comprehension.",
        "I once held that the young had nothing to teach the old. The young, I now know, are often the only honest mirrors in the room.",
      ],
      es: [
        "Que el divorcio era un fracaso. Mi hija se divorció y entendí que a veces es lo más sagrado que se puede hacer.",
        "Pensaba que la terapia era para los blandos. La terapia salvó mi matrimonio.",
        "Solía creer que el perdón requería entender al ofensor. Ya no lo creo; a veces uno perdona en ausencia de comprensión.",
        "Antes sostenía que los jóvenes no tenían nada que enseñar a los viejos. Ahora sé que los jóvenes son, con frecuencia, los únicos espejos honestos en la sala.",
      ],
    },
  },
  {
    id: 111,
    category: "quiet",
    depth: "soul",
    en: "Is there a prayer or phrase you whisper to yourself, even when you don't think you believe?",
    es: "¿Hay una oración o frase que susurras para ti mismo, incluso cuando no crees del todo?",
    randomizeOptions: {
      en: [
        "\"Dios mío, ayúdame.\" Lo digo cuando no sé qué más decir. Cuenta o no cuenta, igual lo digo.",
        "\"Don't be a coward.\" Said it most days of my life. Still works.",
        "\"Let me be useful, and let me be kind.\" That's the whole one. I say it when I don't know what else to do.",
        "\"Be it unto me according to thy word.\" An archaic phrase from my grandmother. It steadies me, somehow.",
      ],
      es: [
        "\"Dios mío, ayúdame.\" Lo digo cuando no sé qué más decir. Cuente o no cuente, lo digo igual.",
        "\"No seas cobarde.\" Lo dije casi todos los días de mi vida. Sigue funcionando.",
        "\"Déjame ser útil, y déjame ser amable.\" Eso es todo. Lo digo cuando no sé qué más hacer.",
        "\"Hágase en mí según tu palabra.\" Una frase arcaica de mi abuela. Me da firmeza, de algún modo.",
      ],
    },
  },
  {
    id: 112,
    category: "values",
    depth: "soul",
    en: "How do you think about God — or whatever stands in the place of that word?",
    es: "¿Cómo piensas en Dios — o en lo que sea que ocupa el lugar de esa palabra?",
    randomizeOptions: {
      en: [
        "Dios es la mano de mi madre cuando yo lloraba de niña. Si eso no es Dios, no sé qué cosa lo sea.",
        "Don't know. Don't pretend to. Try to act right anyway.",
        "I think of it as the listening room — whatever, whoever, however the listening happens. The word doesn't matter; the listening does.",
        "I have, after eight decades, settled on a polite agnosticism with monastic leanings. I do not require the answer; I require the question.",
      ],
      es: [
        "Dios es la mano de mi madre cuando yo lloraba de niña. Si eso no es Dios, no sé qué lo sea.",
        "No sé. No pretendo saber. Trato de actuar bien igual.",
        "Lo pienso como la sala de escucha — sea como sea, sea quien sea, así sea como ocurra. La palabra no importa; la escucha sí.",
        "He llegado, tras ocho décadas, a un agnosticismo cortés con inclinaciones monásticas. No necesito la respuesta; necesito la pregunta.",
      ],
    },
  },
  {
    id: 113,
    category: "self",
    depth: "surface",
    en: "What's your drink? How do you order it?",
    es: "¿Cuál es tu trago? ¿Cómo lo pides?",
    randomizeOptions: {
      en: [
        "Un cafecito cubano, dulce, en una taza pequeñita. Después de las cinco, una copita de Bailey's si estoy con mi hermana.",
        "Bud Light. Cold. From the bottle.",
        "An old fashioned, properly made — sugar cube, two dashes, orange peel, no fruit salad. I'll wait.",
        "A neat single-malt, twelve years and up. I do not, at my age, complicate matters.",
      ],
      es: [
        "Un cafecito cubano, dulce, en una taza pequeñita. Después de las cinco, una copita de Bailey's si estoy con mi hermana.",
        "Bud Light. Fría. De la botella.",
        "Un old fashioned, bien hecho — terrón de azúcar, dos toques, cáscara de naranja, sin ensalada de fruta. Espero.",
        "Un single-malt sin hielo, de doce años para arriba. A mi edad no complico las cosas.",
      ],
    },
  },
  {
    id: 114,
    category: "self",
    depth: "surface",
    en: "What's a small vice you've kept around because it's yours?",
    es: "¿Cuál es un vicio pequeño que conservas porque es tuyo?",
    randomizeOptions: {
      en: [
        "Una novela en la tarde. Tres horas perdidas. No me arrepiento.",
        "Cigar after Sunday dinner. Doctor doesn't love it. I do.",
        "A glass of wine while I cook, even if no one's coming over. Especially then.",
        "An evening pipe. Two bowls. A glass of port. Civilization, after a fashion.",
      ],
      es: [
        "Una novela en la tarde. Tres horas perdidas. No me arrepiento.",
        "Un puro después de la cena del domingo. Al doctor no le encanta. A mí sí.",
        "Una copa de vino mientras cocino, aunque no venga nadie. Sobre todo entonces.",
        "Una pipa por la noche. Dos cazoletas. Una copa de oporto. Civilización, a su manera.",
      ],
    },
  },
  {
    id: 115,
    category: "self",
    depth: "surface",
    en: "What's a quiet vanity you have, even if you'd never say so out loud?",
    es: "¿Cuál es una vanidad callada que tienes, aunque nunca la dirías en voz alta?",
    randomizeOptions: {
      en: [
        "Mis uñas. Las llevo cortas y limpias. Las miro mientras tomo café.",
        "I keep my truck cleaner than my house. Everyone notices. I don't say anything.",
        "I'm proud of how I move through a room. I don't perform it. I just know.",
        "My posture, even at this age. I have, as my father did, refused the slouch.",
      ],
      es: [
        "Mis uñas. Las llevo cortas y limpias. Las miro mientras tomo café.",
        "Tengo la camioneta más limpia que la casa. Todos lo notan. No digo nada.",
        "Estoy orgullosa de cómo me muevo en un cuarto. No lo actúo. Sólo lo sé.",
        "Mi postura, incluso a esta edad. He rechazado, como mi padre, la encorvadura.",
      ],
    },
  },

  // — Batch 5 (116–145) —
  {
    id: 116,
    category: "love",
    depth: "depth",
    en: "Tell me about a friendship that ended quietly. Do you wish you'd fought for it?",
    es: "Cuéntame de una amistad que se acabó en silencio. ¿Hubieras peleado por ella?",
    randomizeOptions: {
      en: [
        "Mi amiga del barrio, Lourdes. Nos peleamos por una tontería. La extraño todavía. Sí, hubiera peleado.",
        "Buddy from work. He moved. Calls stopped. Yeah, I'd have fought for it.",
        "A friend from college. We drifted, then she stopped responding. I wish I'd shown up at her door once.",
        "A colleague who once was a confidant. Time, miles, and unread letters did the rest. I have, on slow afternoons, regretted the silence.",
      ],
      es: [
        "Mi amiga del barrio, Lourdes. Nos peleamos por una tontería. La extraño todavía. Sí, hubiera peleado.",
        "Un cuate del trabajo. Se mudó. Las llamadas pararon. Sí, hubiera peleado.",
        "Una amiga de la universidad. Nos alejamos, luego dejó de contestar. Hubiera tocado su puerta una vez.",
        "Un colega que un día fue confidente. El tiempo, las millas, y las cartas sin leer hicieron el resto. He lamentado el silencio en las tardes lentas.",
      ],
    },
  },
  {
    id: 117,
    category: "self",
    depth: "texture",
    en: "Is there something you cook that everyone says is yours?",
    es: "¿Hay algo que cocinas y todos dicen que es tuyo?",
    randomizeOptions: {
      en: [
        "Mi flan. Ni mi hermana lo hace como yo. La receta es de mi mami con un cambio que sólo yo sé.",
        "Chili. Cooked it the same way for twenty years. Don't ask for the recipe.",
        "A dal that I learned from a roommate years ago and have been refining since. People close their eyes when they eat it.",
        "A roast lamb at Easter — the one my late wife taught me. The recipe is, by now, in my hands.",
      ],
      es: [
        "Mi flan. Ni mi hermana lo hace como yo. La receta es de mi mami con un cambio que sólo yo sé.",
        "Chili. Lo cocino igual hace veinte años. No pidas la receta.",
        "Un dal que aprendí de un compañero de cuarto hace años y he ido refinando. La gente cierra los ojos al comerlo.",
        "Un cordero asado en Pascua — el que me enseñó mi difunta esposa. La receta está, a estas alturas, en mis manos.",
      ],
    },
  },
  {
    id: 118,
    category: "family",
    depth: "texture",
    en: "What's something — physical or otherwise — that was passed down to you?",
    es: "¿Qué cosa — física o no — te pasaron de generación?",
    randomizeOptions: {
      en: [
        "El reloj de mi abuela. Y la costumbre de echarle azúcar al café. Las dos cosas las uso todos los días.",
        "Dad's pocketknife. Carried it twenty years. He carried it forty before that.",
        "A way of laughing — half a chuckle, half a sigh. My grandmother had it. Apparently, so do I.",
        "A small writing desk that came over with my great-grandmother. I write at it most mornings.",
      ],
      es: [
        "El reloj de mi abuela. Y la costumbre de echarle azúcar al café. Las dos cosas las uso todos los días.",
        "La navaja de bolsillo de mi papá. La traje veinte años. Él la trajo cuarenta antes.",
        "Una forma de reírme — media risita, medio suspiro. Mi abuela la tenía. Aparentemente, yo también.",
        "Un escritorio pequeño que llegó con mi bisabuela. Escribo en él casi todas las mañanas.",
      ],
    },
  },
  {
    id: 119,
    category: "self",
    depth: "depth",
    en: "When did you last cry? What set it off?",
    es: "¿Cuándo lloraste por última vez? ¿Qué te hizo llorar?",
    randomizeOptions: {
      en: [
        "Esta mañana. Una canción en la radio que ponía mi mami cuando yo era niña.",
        "Last week. Don't want to talk about it.",
        "Yesterday afternoon. A line in a book that named something I hadn't been able to.",
        "The other day, in fact, while reading a letter from a friend whose handwriting has not, in forty years, lost its capacity to undo me.",
      ],
      es: [
        "Esta mañana. Una canción en la radio que ponía mi mami cuando yo era niña.",
        "La semana pasada. No quiero hablar de eso.",
        "Ayer en la tarde. Una frase en un libro que nombró algo que yo no había podido nombrar.",
        "El otro día, de hecho, leyendo una carta de un amigo cuya letra no ha perdido, en cuarenta años, la capacidad de deshacerme.",
      ],
    },
  },
  {
    id: 120,
    category: "work",
    depth: "texture",
    en: "What was your first really hard job, and what did it forge in you?",
    es: "¿Cuál fue tu primer trabajo realmente duro, y qué forjó en ti?",
    randomizeOptions: {
      en: [
        "Lavando platos en un restaurante doce horas. Aprendí lo que es estar de pie hasta no sentir las piernas. Y aprendí a no quejarme.",
        "Roofing in July. Hot, mean work. Made me not afraid of hard things.",
        "Waiting tables on the late shift. The exhaustion sharpened me. The tips taught me how to read a room.",
        "Working the overnight at a small printing press, in 1957. The smell of ink and the steady hum of machinery taught me the dignity of competent quiet.",
      ],
      es: [
        "Lavando platos en un restaurante doce horas. Aprendí lo que es estar de pie hasta no sentir las piernas. Y aprendí a no quejarme.",
        "Poner techos en julio. Calor, trabajo bruto. Me quitó el miedo a las cosas duras.",
        "Mesera en el turno de la noche. El cansancio me afiló. Las propinas me enseñaron a leer un cuarto.",
        "Trabajando turno nocturno en una pequeña imprenta, en 1957. El olor a tinta y el zumbido constante de la maquinaria me enseñaron la dignidad del silencio competente.",
      ],
    },
  },
  {
    id: 121,
    category: "stories",
    depth: "depth",
    en: "What's the closest you think you've come to dying?",
    es: "¿Cuál crees que ha sido el momento en que más cerca estuviste de morir?",
    randomizeOptions: {
      en: [
        "Un parto que se complicó. La nena salió bien. Yo sangré por horas. Vi mucha luz. No sé qué pensar de eso.",
        "Black ice on a highway, '04. Spun out three times. Walked away.",
        "A near-drowning at twenty-three. The water was very calm afterward.",
        "An incident in 1953 that I will not, in this format, describe. Suffice it to say I have not, since, taken any morning lightly.",
      ],
      es: [
        "Un parto que se complicó. La nena salió bien. Yo sangré por horas. Vi mucha luz. No sé qué pensar de eso.",
        "Hielo negro en una carretera, en el 04. Giré tres veces. Salí caminando.",
        "Casi me ahogué a los veintitrés. El agua quedó muy tranquila después.",
        "Un incidente en 1953 que no describiré en este formato. Baste decir que no he tomado, desde entonces, ninguna mañana a la ligera.",
      ],
    },
  },
  {
    id: 122,
    category: "love",
    depth: "texture",
    en: "Tell me about your first real date. Where did you go, and how did it actually go?",
    es: "Cuéntame de tu primera cita de verdad. ¿A dónde fueron, y cómo te fue de verdad?",
    randomizeOptions: {
      en: [
        "Al malecón. Dieciséis años. Hablamos cinco horas. No me besó. Yo lo prefería así.",
        "Took her to a movie. Don't remember which one. Spilled my drink. She still married me.",
        "A coffee shop that closed at ten. We stayed until closing and then walked to a park. He kissed my hand. I went home and wrote a poem.",
        "A dinner in 1958 that I prepared, badly, in a borrowed apartment. She, with grace, ate the experiment.",
      ],
      es: [
        "Al malecón. Dieciséis años. Hablamos cinco horas. No me besó. Yo lo prefería así.",
        "La llevé al cine. No recuerdo cuál. Tiré mi refresco. Igual se casó conmigo.",
        "Una cafetería que cerraba a las diez. Nos quedamos hasta el cierre y luego caminamos a un parque. Me besó la mano. Llegué a casa y escribí un poema.",
        "Una cena en 1958 que preparé, mal, en un apartamento prestado. Ella, con gracia, se comió el experimento.",
      ],
    },
  },
  {
    id: 123,
    category: "values",
    depth: "depth",
    en: "Is there a guilt you carry quietly that no one else knows about?",
    es: "¿Hay una culpa que cargas en silencio y nadie más conoce?",
    randomizeOptions: {
      en: [
        "Que no estuve con mi mami el día que murió. Llegué dos horas después. Lo cargo.",
        "Said something to my brother twenty years ago. Never took it back. Carry it.",
        "I let a friend down at a moment when she needed me. I have apologized; I am the one who hasn't moved on.",
        "A small unkindness, four decades old, to a person who would not now remember it. I, however, do.",
      ],
      es: [
        "Que no estuve con mi mami el día que murió. Llegué dos horas después. Lo cargo.",
        "Le dije algo a mi hermano hace veinte años. Nunca me retracté. Lo cargo.",
        "Le fallé a una amiga en un momento en que me necesitaba. Le pedí perdón; soy yo la que no lo ha soltado.",
        "Una pequeña falta de bondad, hace cuatro décadas, a una persona que ya no la recordaría. Yo, sin embargo, sí.",
      ],
    },
  },
  {
    id: 124,
    category: "love",
    depth: "depth",
    en: "Who do you owe — really owe — for the person you turned out to be?",
    es: "¿A quién le debes — de verdad — la persona que llegaste a ser?",
    randomizeOptions: {
      en: [
        "A mi mami, sin duda. Y a una vecina que no se llamaba familia pero lo era. Las dos juntas me hicieron.",
        "My old man. He didn't say much but he stayed.",
        "A high school librarian whose name I'll never tell anyone, because she is mine.",
        "A particular professor, now decades dead, who in 1962 gave me a single afternoon of his serious attention.",
      ],
      es: [
        "A mi mami, sin duda. Y a una vecina que no era familia pero lo era. Las dos juntas me hicieron.",
        "Mi viejo. No hablaba mucho pero se quedó.",
        "A una bibliotecaria de la prepa cuyo nombre no le diré a nadie, porque es mío.",
        "A un profesor particular, ya muerto hace décadas, que en 1962 me dedicó una sola tarde de su atención seria.",
      ],
    },
  },
  {
    id: 125,
    category: "place",
    depth: "texture",
    en: "Was there a starry night you remember in particular? Where were you?",
    es: "¿Hubo una noche estrellada que recuerdes en particular? ¿Dónde estabas?",
    randomizeOptions: {
      en: [
        "En el campo, cerca de Camagüey. Tenía nueve años. Mi tío me dijo: 'cada estrella es una persona pensándote.'",
        "Wyoming, summer of '88. Lay on the truck bed. Didn't say a word for an hour.",
        "On a roof in college. Cheap wine. Someone's hand near mine. The Milky Way, somehow visible. I have not been the same.",
        "An island off the coast of Maine, August 1971. The Pleiades. I knelt without intending to.",
      ],
      es: [
        "En el campo, cerca de Camagüey. Tenía nueve años. Mi tío me dijo: 'cada estrella es una persona pensándote.'",
        "Wyoming, verano del 88. Acostado en la batea. No dije una palabra en una hora.",
        "En un techo en la universidad. Vino barato. La mano de alguien cerca de la mía. La Vía Láctea, de alguna forma visible. No volví a ser la misma.",
        "Una isla frente a la costa de Maine, agosto de 1971. Las Pléyades. Me arrodillé sin proponérmelo.",
      ],
    },
  },
  {
    id: 126,
    category: "values",
    depth: "depth",
    en: "What's a core belief you'd defend even if it cost you something?",
    es: "¿Cuál es una creencia central que defenderías aunque te costara algo?",
    randomizeOptions: {
      en: [
        "Que a la familia se le cuida. Aunque te toque a ti pagar la cuenta. Aunque no tengas.",
        "You don't kick people when they're down. Period.",
        "That kindness, in the end, is more durable than power. I will lose the argument before I'll lose this.",
        "That no person is, ever, simply their worst hour. I have, on this point, declined to be argued with.",
      ],
      es: [
        "Que a la familia se le cuida. Aunque te toque a ti pagar la cuenta. Aunque no tengas.",
        "No le pegas a la gente cuando está caída. Punto.",
        "Que la bondad, al final, es más duradera que el poder. Pierdo el argumento antes de perder esto.",
        "Que ninguna persona es, jamás, sólo su peor hora. He declinado, en este punto, ser convencido.",
      ],
    },
  },
  {
    id: 127,
    category: "family",
    depth: "texture",
    en: "Was there a song someone sang to you to fall asleep? What was it?",
    es: "¿Hubo una canción que alguien te cantaba para dormir? ¿Cuál era?",
    randomizeOptions: {
      en: [
        "Mami me cantaba 'Duérmete mi niña.' Bajito. Yo me hacía la dormida para que siguiera.",
        "Don't remember a lullaby. Mom sang along to the radio. That counted.",
        "My grandmother sang \"You Are My Sunshine\" off-key. Off-key was part of the medicine.",
        "An old folk song my mother brought from Donegal. I have not heard it sung since 1949 and I can hum it perfectly.",
      ],
      es: [
        "Mami me cantaba 'Duérmete mi niña.' Bajito. Yo me hacía la dormida para que siguiera.",
        "No recuerdo una canción de cuna. Mi mamá cantaba con la radio. Eso contaba.",
        "Mi abuela cantaba \"You Are My Sunshine\" desafinada. Desafinada era parte de la medicina.",
        "Una vieja canción folklórica que mi madre trajo de Donegal. No la he escuchado cantada desde 1949 y la tarareo perfectamente.",
      ],
    },
  },
  {
    id: 128,
    category: "self",
    depth: "depth",
    en: "Tell me about a time you were profoundly lonely. Did anyone find you?",
    es: "Cuéntame de una vez en que estuviste profundamente sola/solo. ¿Alguien te encontró?",
    randomizeOptions: {
      en: [
        "El primer mes en Miami. Una vecina cubana me trajo una sopa. No me preguntó nada. Eso me salvó.",
        "Year after my divorce. Bad year. My brother showed up. Didn't talk. Stayed.",
        "The winter I was twenty-six, in a city where I knew no one. A bookseller began to recognize me. That was enough.",
        "After my wife passed, the spring of 2020. A former student wrote, weekly, for a year. He has, in his way, saved my life.",
      ],
      es: [
        "El primer mes en Miami. Una vecina cubana me trajo una sopa. No me preguntó nada. Eso me salvó.",
        "El año después de mi divorcio. Mal año. Mi hermano apareció. No habló. Se quedó.",
        "El invierno en que tenía veintiséis, en una ciudad donde no conocía a nadie. Un librero empezó a reconocerme. Con eso bastó.",
        "Después de que murió mi esposa, primavera del 2020. Un antiguo estudiante me escribió, semanalmente, durante un año. Me ha salvado, a su manera, la vida.",
      ],
    },
  },
  {
    id: 129,
    category: "values",
    depth: "soul",
    en: "What gives your life meaning, on a Tuesday afternoon when nothing is happening?",
    es: "¿Qué le da sentido a tu vida un martes en la tarde cuando no pasa nada?",
    randomizeOptions: {
      en: [
        "Una llamada de mi nieta. Dos minutos. Eso es todo. Y la tarde tiene sentido.",
        "The dog. The light. A decent sandwich. That's plenty.",
        "Knowing that someone, somewhere, is going to be slightly less alone because I existed.",
        "The rereading of a poem I've known since 1947, which has not, on any of those readings, exhausted me.",
      ],
      es: [
        "Una llamada de mi nieta. Dos minutos. Es todo. Y la tarde tiene sentido.",
        "El perro. La luz. Un sándwich decente. Es suficiente.",
        "Saber que alguien, en algún lugar, va a estar un poco menos solo porque yo existí.",
        "La relectura de un poema que conozco desde 1947, que no me ha agotado, en ninguna de esas lecturas.",
      ],
    },
  },
  {
    id: 130,
    category: "self",
    depth: "surface",
    en: "What's your favorite smell in the world?",
    es: "¿Cuál es tu olor favorito en el mundo?",
    randomizeOptions: {
      en: [
        "El café molido fresco. Y la cabecita de un bebé recién bañado.",
        "Sawdust. Always sawdust.",
        "Petrichor — that smell when rain hits dry earth. There's no English word for it that's better than petrichor.",
        "The pages of an old book, opened in a quiet room.",
      ],
      es: [
        "El café molido fresco. Y la cabecita de un bebé recién bañado.",
        "Aserrín. Siempre aserrín.",
        "Petricor — ese olor cuando la lluvia toca la tierra seca. No hay palabra en español que le quede mejor.",
        "Las páginas de un libro viejo, abierto en un cuarto silencioso.",
      ],
    },
  },
  {
    id: 131,
    category: "stories",
    depth: "texture",
    en: "Tell me about a dance you remember. Who were you with? What song?",
    es: "Cuéntame de un baile que recuerdes. ¿Con quién estabas? ¿Qué canción?",
    randomizeOptions: {
      en: [
        "Bailando 'Dos gardenias' con Hector en la sala. Él no bailaba bien. Pero conmigo sí.",
        "Wedding. '99. With my wife. Some Eric Clapton song. We were the only ones still on the floor.",
        "A friend's kitchen, post-midnight, to a slow Stevie Wonder track. We were drunk and lonely and, briefly, fine.",
        "A USO dance, summer of 1944, with a girl whose name I no longer recall but whose laugh I do.",
      ],
      es: [
        "Bailando 'Dos gardenias' con Hector en la sala. Él no bailaba bien. Pero conmigo sí.",
        "Boda. 99. Con mi esposa. Una canción de Eric Clapton. Éramos los únicos que seguían en la pista.",
        "La cocina de una amiga, después de medianoche, con una canción lenta de Stevie Wonder. Estábamos borrachos y solos y, brevemente, bien.",
        "Un baile de la USO, verano de 1944, con una muchacha cuyo nombre ya no recuerdo pero cuya risa sí.",
      ],
    },
  },
  {
    id: 132,
    category: "work",
    depth: "texture",
    en: "Was there a boss who actually taught you something? What was it?",
    es: "¿Hubo un jefe que de verdad te enseñó algo? ¿Qué fue?",
    randomizeOptions: {
      en: [
        "Doña Ana. Mi primera jefa. Me dijo: 'mira a la gente cuando le hablas.' Lo hago todavía.",
        "First foreman. Said: 'Show up early, don't talk much, do the job.' Still good advice.",
        "A boss who corrected me without making me small. I have, since, tried to be that for the people who work with me.",
        "A senior partner who, in 1973, taught me to read a contract by candlelight after a power outage. The lesson, I now suspect, was less about contracts.",
      ],
      es: [
        "Doña Ana. Mi primera jefa. Me dijo: 'mira a la gente cuando le hablas.' Lo hago todavía.",
        "Mi primer capataz. Me dijo: 'llega temprano, habla poco, haz el trabajo.' Sigue siendo buen consejo.",
        "Una jefa que me corregía sin hacerme pequeño. He intentado, desde entonces, ser eso para los que trabajan conmigo.",
        "Un socio mayor que, en 1973, me enseñó a leer un contrato a la luz de una vela después de un apagón. La lección, ahora sospecho, no era tanto sobre contratos.",
      ],
    },
  },
  {
    id: 133,
    category: "values",
    depth: "depth",
    en: "Who do you resent quietly, and have you let it go?",
    es: "¿A quién resentías en silencio, y ya lo soltaste?",
    randomizeOptions: {
      en: [
        "Una hermana mayor que se llevó atención que yo necesitaba. Tardé décadas. Ya casi.",
        "Old man. Too late to do anything but accept it.",
        "A friend who hurt me when I was twenty-eight. I haven't fully released it. I'm working on it without expecting to finish.",
        "A relative who, in 1979, did not, when it counted, do the right thing. I have, after lengthy reflection, decided that I shall let her keep her version.",
      ],
      es: [
        "Una hermana mayor que se llevó la atención que yo necesitaba. Tardé décadas. Ya casi.",
        "Mi viejo. Demasiado tarde para hacer otra cosa que aceptarlo.",
        "Una amiga que me lastimó cuando tenía veintiocho. No lo he soltado del todo. Estoy en eso sin esperar terminar.",
        "Una pariente que, en 1979, cuando contó, no hizo lo correcto. He decidido, tras larga reflexión, dejarle su versión.",
      ],
    },
  },
  {
    id: 134,
    category: "stories",
    depth: "texture",
    en: "What's the hardest you've ever laughed? What set it off?",
    es: "¿Cuánto fue lo más fuerte que te has reído? ¿Qué te puso así?",
    randomizeOptions: {
      en: [
        "Mi tía Olga contando un chiste viejo en el funeral de mi tío Pepe. We weren't supposed to laugh and we couldn't stop.",
        "Buddy fell off a porch trying to flirt. Not hurt. Devastating.",
        "A friend's impression of my own mother at thanksgiving. I cried. I hadn't laughed like that in years.",
        "A piece of academic prose so absurd I read it aloud at dinner. My wife and I did not, that evening, fully recover.",
      ],
      es: [
        "Mi tía Olga contando un chiste viejo en el funeral de mi tío Pepe. No debíamos reírnos y no podíamos parar.",
        "Un cuate se cayó de un porche tratando de coquetear. No se lastimó. Devastador.",
        "Una amiga imitando a mi propia madre en Acción de Gracias. Lloré. No me había reído así en años.",
        "Un fragmento de prosa académica tan absurdo que lo leí en voz alta en la cena. Mi esposa y yo no nos recuperamos del todo esa noche.",
      ],
    },
  },
  {
    id: 135,
    category: "stories",
    depth: "texture",
    en: "Tell me about a long wait you remember — for what, and how it was.",
    es: "Cuéntame de una espera larga que recuerdes — por qué, y cómo fue.",
    randomizeOptions: {
      en: [
        "Esperando que mi nena saliera del quirófano. Cuatro horas. Recé tres rosarios. La saqué bien.",
        "Two weeks waiting on a biopsy. Slept poorly. Came back negative. Slept worse for a week after.",
        "Six hours in a courthouse hallway. The light was terrible. I read every magazine. The decision was kinder than I expected.",
        "An overnight in a railway station in 1970, somewhere in Central Europe. The wait was both interminable and, in retrospect, the night of my life.",
      ],
      es: [
        "Esperando que mi nena saliera del quirófano. Cuatro horas. Recé tres rosarios. La saqué bien.",
        "Dos semanas esperando una biopsia. Dormí mal. Salió negativa. Dormí peor la semana siguiente.",
        "Seis horas en el pasillo de un juzgado. La luz era terrible. Leí cada revista. El fallo fue más amable de lo que esperaba.",
        "Una noche entera en una estación de tren en 1970, en algún lugar de Europa Central. La espera fue interminable y, en retrospectiva, la noche de mi vida.",
      ],
    },
  },
  {
    id: 136,
    category: "childhood",
    depth: "texture",
    en: "First time you slept over at a friend's house — what was their family like?",
    es: "La primera vez que dormiste en casa de un amigo — ¿cómo era esa familia?",
    randomizeOptions: {
      en: [
        "Donde Mariana. Su mami era americana. La cena era diferente. La televisión durante la cena. Lo encontré exótico y un poco triste.",
        "Friend named Eddie. Family yelled all night. Thought it was normal. Realized later it wasn't.",
        "At my friend Sarah's. Quiet, serious, funny in a way I hadn't seen. They asked each other questions at dinner. I went home wanting that.",
        "A childhood friend's, in 1948. The family was, by my standards, unbearably formal. I have, in my own house, recreated some of that order.",
      ],
      es: [
        "Donde Mariana. Su mami era americana. La cena era diferente. La televisión durante la cena. Me pareció exótico y un poco triste.",
        "Un amigo llamado Eddie. La familia gritaba toda la noche. Pensé que era normal. Después me di cuenta de que no.",
        "En casa de mi amiga Sarah. Tranquilos, serios, chistosos de una forma que yo no había visto. Se hacían preguntas en la cena. Me fui a casa queriendo eso.",
        "En casa de un amigo de la infancia, en 1948. La familia era, según mis estándares, insoportablemente formal. He recreado, en mi propia casa, parte de ese orden.",
      ],
    },
  },
  {
    id: 137,
    category: "love",
    depth: "depth",
    en: "Have you seen a man cry in a way you'll never forget? Tell me.",
    es: "¿Has visto a un hombre llorar de una manera que no olvidarás? Cuéntame.",
    randomizeOptions: {
      en: [
        "A mi papá, cuando murió mi mami. Nunca lo había visto llorar. Se rompió por dentro y nunca volvió a ser el mismo.",
        "Buddy of mine. Funeral. Tough guy. Kid pulled it out of him.",
        "My uncle, the Sunday after his wife died. He was making coffee and stopped halfway and put his hands on the counter.",
        "A colleague, after a difficult diagnosis, simply sitting in his office with the door open. I have not, since, undervalued the gift of an open door.",
      ],
      es: [
        "A mi papá, cuando murió mi mami. Nunca lo había visto llorar. Se rompió por dentro y nunca volvió a ser el mismo.",
        "Un cuate mío. Funeral. Hombre duro. Su hijo se lo sacó.",
        "Mi tío, el domingo después de que murió su esposa. Estaba haciendo café y se quedó a medias y puso las manos en la encimera.",
        "Un colega, tras un diagnóstico difícil, sentado nada más en su oficina con la puerta abierta. No he subestimado, desde entonces, el regalo de una puerta abierta.",
      ],
    },
  },
  {
    id: 138,
    category: "stories",
    depth: "texture",
    en: "Have you ever watched someone work with their hands and lost track of time?",
    es: "¿Alguna vez viste a alguien trabajar con las manos y se te fue el tiempo?",
    randomizeOptions: {
      en: [
        "A una vecina haciendo encaje. Me senté en su patio una tarde entera. Salí distinta.",
        "My old man rebuilding a small block. Watched four hours. Didn't say a word.",
        "A bookbinder at a market in Lisbon. He didn't speak my language. We stood in shared silence for an hour.",
        "A clockmaker in Geneva, in 1981. He spoke very little and worked very precisely. I have not, since, watched television without contempt.",
      ],
      es: [
        "A una vecina haciendo encaje. Me senté en su patio una tarde entera. Salí distinta.",
        "Mi viejo reconstruyendo un block chico. Lo vi cuatro horas. No dije una palabra.",
        "Un encuadernador en un mercado en Lisboa. No hablaba mi idioma. Estuvimos parados en silencio compartido una hora.",
        "Un relojero en Ginebra, en 1981. Hablaba muy poco y trabajaba con precisión. No he vuelto a ver televisión, desde entonces, sin desprecio.",
      ],
    },
  },
  {
    id: 139,
    category: "place",
    depth: "texture",
    en: "What's a walk you've taken many times, and why does it pull you back?",
    es: "¿Cuál es una caminata que has hecho muchas veces, y por qué te atrae?",
    randomizeOptions: {
      en: [
        "El malecón al amanecer. Los pelícanos. Las viejitas haciendo ejercicio. Volveré mientras me dejen las piernas.",
        "Around the lake near my house. Three miles. Done it ten thousand times.",
        "The long block near my apartment, all the way to the river. I walk it when I need to think and don't want to be seen thinking.",
        "A cobblestone lane in a particular New England town, beneath the maples. I have, in seventy-five years, found nothing else as steadying.",
      ],
      es: [
        "El malecón al amanecer. Los pelícanos. Las viejitas haciendo ejercicio. Volveré mientras me dejen las piernas.",
        "Vuelta al lago cerca de la casa. Tres millas. La he hecho diez mil veces.",
        "La cuadra larga cerca de mi apartamento, hasta el río. La camino cuando necesito pensar y no quiero que me vean pensando.",
        "Un sendero adoquinado en cierto pueblo de Nueva Inglaterra, bajo los arces. No he encontrado, en setenta y cinco años, nada igual de tranquilizador.",
      ],
    },
  },
  {
    id: 140,
    category: "place",
    depth: "texture",
    en: "Is there a body of water — sea, river, lake — that means home, no matter where you are?",
    es: "¿Hay un cuerpo de agua — mar, río, lago — que signifique hogar, sin importar dónde estés?",
    randomizeOptions: {
      en: [
        "El mar de Cuba. Cuando huelo agua salada en cualquier parte, soy una niña en la playa con mi mami.",
        "Lake Erie. Don't laugh. It made me.",
        "A small lake in Maine my family rented one summer. I have not, since, found water with the same green.",
        "The Charles, viewed from the bridge near my graduate apartment. The world has, in my mind, two centers, and one of them is that view.",
      ],
      es: [
        "El mar de Cuba. Cuando huelo agua salada en cualquier parte, soy una niña en la playa con mi mami.",
        "El lago Erie. No te rías. Me hizo.",
        "Un lago chico en Maine que mi familia alquiló un verano. No he encontrado, desde entonces, agua del mismo verde.",
        "El Charles, visto desde el puente cerca de mi apartamento del posgrado. El mundo tiene, en mi mente, dos centros, y uno de ellos es esa vista.",
      ],
    },
  },
  {
    id: 141,
    category: "family",
    depth: "depth",
    en: "What's a small thing you got from your grandmother — physical or otherwise — that you carry?",
    es: "¿Qué cosita te dejó tu abuela — física o no — que cargas contigo?",
    randomizeOptions: {
      en: [
        "Su forma de decir 'mi vida.' Yo se lo digo a mis nietos. Ella lo escucha, donde sea que esté.",
        "Her wooden rolling pin. Use it for biscuits. Once a month.",
        "A way of looking at strangers as if they might surprise you. They mostly do.",
        "An expression — half scolding, half affection — that, in moments of mild inconvenience, comes to my face entirely without my permission.",
      ],
      es: [
        "Su forma de decir 'mi vida.' Se lo digo a mis nietos. Ella lo escucha, donde sea que esté.",
        "Su rodillo de madera. Lo uso para galletas. Una vez al mes.",
        "Una forma de mirar a los desconocidos como si pudieran sorprenderte. Casi siempre lo hacen.",
        "Una expresión — mitad regañón, mitad cariño — que, en momentos de inconveniencia menor, me llega a la cara enteramente sin permiso.",
      ],
    },
  },
  {
    id: 142,
    category: "self",
    depth: "texture",
    en: "Is there a song you used to love and now skip?",
    es: "¿Hay una canción que antes adorabas y que ahora te saltas?",
    randomizeOptions: {
      en: [
        "Una de Marc Anthony. La bailaba con un novio que después fue malo conmigo. Ya no puedo escucharla.",
        "Anything from that summer in '08. Skip it. Don't ask.",
        "An old indie track I played at a bad time in my twenties. The riff still gives me a small shiver.",
        "A piece of 1960s pop that, despite its considerable charm, is now indelibly associated with a person I would prefer not to remember.",
      ],
      es: [
        "Una de Marc Anthony. La bailaba con un novio que después fue malo conmigo. Ya no la puedo escuchar.",
        "Cualquier cosa de ese verano del 08. Sáltala. No preguntes.",
        "Una vieja canción indie que ponía en una mala época en mis veintes. El riff aún me da un pequeño escalofrío.",
        "Una pieza de pop de los años sesenta que, pese a su considerable encanto, está ahora indeleblemente asociada con una persona que preferiría no recordar.",
      ],
    },
  },
  {
    id: 143,
    category: "family",
    depth: "texture",
    en: "How was your name chosen? Who chose it?",
    es: "¿Cómo escogieron tu nombre? ¿Quién lo escogió?",
    randomizeOptions: {
      en: [
        "Mi mami. Por la Virgen del Carmen. Le prometió que si yo nacía bien, me ponía el nombre.",
        "Dad's. Family name. Three before me.",
        "After a great-grandmother nobody knew except in stories. I have lived with the responsibility of being named for a stranger.",
        "A compromise reached between my father and his mother, at considerable cost to both. The compromise has, on balance, served me well.",
      ],
      es: [
        "Mi mami. Por la Virgen del Carmen. Le prometió que si yo nacía bien, me ponía el nombre.",
        "Mi papá. Nombre de familia. Tres antes que yo.",
        "Por una bisabuela que nadie conoció excepto en historias. He vivido con la responsabilidad de tener el nombre de una desconocida.",
        "Un acuerdo alcanzado entre mi padre y su madre, a costo considerable para ambos. El acuerdo, en balance, me ha servido bien.",
      ],
    },
  },
  {
    id: 144,
    category: "stories",
    depth: "texture",
    en: "Tell me about a prank — pulled on you, or by you — that actually landed.",
    es: "Cuéntame de una broma — a ti, o tuya — que de verdad funcionó.",
    randomizeOptions: {
      en: [
        "Mi hermana me convenció a los siete años de que el coco vivía en el ropero. Le creí dos años. Aún se lo cobro.",
        "Wired the toolbox shut on the new guy. He didn't think it was funny. We did.",
        "A friend filled my apartment with balloons for my thirtieth. I cried, laughed, and have not been quite the same.",
        "A colleague replaced, undetectably, the contents of my office mug with a tea so awful it took me a full minute to register the offense.",
      ],
      es: [
        "Mi hermana me convenció a los siete años de que el coco vivía en el ropero. Le creí dos años. Aún se lo cobro.",
        "Le soldamos la caja de herramientas al nuevo. No le hizo gracia. A nosotros sí.",
        "Una amiga me llenó el apartamento de globos para mis treinta. Lloré, me reí, y no he sido del todo la misma.",
        "Un colega reemplazó, sin que se notara, el contenido de mi taza de oficina con un té tan horrible que tardé un minuto entero en registrar la ofensa.",
      ],
    },
  },
  {
    id: 145,
    category: "values",
    depth: "depth",
    en: "Is there something you've held onto longer than you should have? What is it costing you?",
    es: "¿Hay algo que has cargado más tiempo del que debías? ¿Qué te está costando?",
    randomizeOptions: {
      en: [
        "Un orgullo con mi prima. Veinte años. Me cuesta a ella. La voy a llamar este mes. Lo digo en serio esta vez.",
        "Resentment toward a guy who did me dirty in '92. Costs me sleep. Letting it go is harder than holding it.",
        "A grievance with my own younger self. I'm trying to release it, slowly. The cost is a quiet self-rejection that doesn't serve anyone.",
        "A particular grudge, decades old, the maintenance of which has, on reflection, cost me more than the original injury.",
      ],
      es: [
        "Un orgullo con mi prima. Veinte años. Me cuesta a ella. La voy a llamar este mes. Esta vez lo digo en serio.",
        "Resentimiento con un tipo que me jodió en el 92. Me cuesta el sueño. Soltarlo es más difícil que sostenerlo.",
        "Un agravio con mi propio yo más joven. Lo estoy soltando, despacio. El costo es un rechazo silencioso de mí misma que no sirve a nadie.",
        "Cierto rencor, de décadas, cuyo mantenimiento, pensándolo bien, me ha costado más que la herida original.",
      ],
    },
  },

  // — Batch 6 (146–175) —
  {
    id: 146,
    category: "self",
    depth: "texture",
    en: "How do you start your day, before anyone else needs anything from you?",
    es: "¿Cómo empiezas el día, antes de que alguien te pida algo?",
    randomizeOptions: {
      en: [
        "Café, rosario, y un rato sentada mirando por la ventana. No hablo con nadie todavía.",
        "Coffee. Pants. Out the door.",
        "A glass of water, ten slow breaths, the same poem on a Wednesday. The mornings are the only thing I own outright.",
        "I rise at six, set the kettle, read the paper at my desk by lamplight. The world, before seven, is mine.",
      ],
      es: [
        "Café, rosario, y un rato sentada mirando por la ventana. Todavía no hablo con nadie.",
        "Café. Pantalones. Salgo.",
        "Un vaso de agua, diez respiraciones lentas, el mismo poema un miércoles. Las mañanas son lo único que poseo del todo.",
        "Me levanto a las seis, pongo la tetera, leo el periódico en mi escritorio con la lámpara encendida. El mundo, antes de las siete, es mío.",
      ],
    },
  },
  {
    id: 147,
    category: "stories",
    depth: "depth",
    en: "Is there a phone call you wish had gone differently?",
    es: "¿Hay una llamada que deseas que hubiera salido distinto?",
    randomizeOptions: {
      en: [
        "La última con mi mami. Le iba a contar algo y me distraje. Hablamos del clima. Tres días después se fue.",
        "Last one with my dad. Two minutes. Should've been twenty.",
        "A late-night call from a friend in crisis I cut short because I was tired. She got through it without me. I didn't get through it.",
        "A call I made, in 1986, in which I should have apologized first. I did not. The other party has long since died.",
      ],
      es: [
        "La última con mi mami. Le iba a contar algo y me distraje. Hablamos del clima. Tres días después se fue.",
        "La última con mi papá. Dos minutos. Debí haber sido veinte.",
        "Una llamada de madrugada de una amiga en crisis que corté porque estaba cansada. Salió adelante sin mí. Yo no salí adelante.",
        "Una llamada que hice, en 1986, en la que debí haber pedido perdón primero. No lo hice. La otra parte murió hace tiempo.",
      ],
    },
  },
  {
    id: 148,
    category: "place",
    depth: "texture",
    en: "Tell me about a window you've stared out of for hours over the years.",
    es: "Cuéntame de una ventana por la que has mirado durante horas con los años.",
    randomizeOptions: {
      en: [
        "La ventana de mi cocina. Veo el patio, los pajaritos, la palma. Treinta años he pensado mi vida ahí.",
        "Kitchen window. Watch the maple. Watched it grow up.",
        "A bedroom window in three different apartments. I have, in some sense, looked out of the same window my whole adult life.",
        "The bay window in our living room. My wife and I sat there for fifty years. The view has not changed; we, of course, have.",
      ],
      es: [
        "La ventana de mi cocina. Veo el patio, los pajaritos, la palma. Treinta años he pensado mi vida ahí.",
        "Ventana de la cocina. Miro el arce. Lo vi crecer.",
        "Una ventana de cuarto en tres apartamentos distintos. He mirado, en cierto sentido, por la misma ventana toda mi vida adulta.",
        "El ventanal de nuestra sala. Mi esposa y yo nos sentamos ahí durante cincuenta años. La vista no ha cambiado; nosotros, por supuesto, sí.",
      ],
    },
  },
  {
    id: 149,
    category: "love",
    depth: "soul",
    en: "Are there words you wish you'd said to someone before they were gone?",
    es: "¿Hay palabras que quisieras haberle dicho a alguien antes de que se fuera?",
    randomizeOptions: {
      en: [
        "A mami. 'Gracias por aguantar.' Lo pensé. No lo dije. Lo digo ahora cada noche.",
        "Should've told my old man I was proud of him. Didn't.",
        "I wish I'd told a friend that I saw her. That I noticed how hard she was trying. She died before I could.",
        "I would have told my younger brother, plainly, that he was loved. He, I believe, knew. I should, in any case, have said it.",
      ],
      es: [
        "A mami. 'Gracias por aguantar.' Lo pensé. No lo dije. Lo digo ahora cada noche.",
        "Le debí decir a mi viejo que estaba orgulloso de él. No lo hice.",
        "Me hubiera gustado decirle a una amiga que la veía. Que notaba cuánto se esforzaba. Murió antes de que pudiera.",
        "Le hubiera dicho a mi hermano menor, sin más, que era amado. Él, creo, lo sabía. Debí, de todas formas, haberlo dicho.",
      ],
    },
  },
  {
    id: 150,
    category: "self",
    depth: "texture",
    en: "What music played while you cooked when you lived on your own for the first time?",
    es: "¿Qué música ponías mientras cocinabas cuando viviste sola/solo por primera vez?",
    randomizeOptions: {
      en: [
        "Pongo la radio en español. Boleros viejos. Cantaba mientras picaba la cebolla.",
        "Springsteen. Always Springsteen.",
        "Joni Mitchell. Specifically Blue. Specifically while making something simple — eggs, toast, soup.",
        "A great deal of Chet Baker. The trumpet, in a small kitchen, is sufficient company.",
      ],
      es: [
        "Pongo la radio en español. Boleros viejos. Cantaba mientras picaba la cebolla.",
        "Springsteen. Siempre Springsteen.",
        "Joni Mitchell. Específicamente Blue. Específicamente mientras hacía algo sencillo — huevos, pan tostado, sopa.",
        "Mucho Chet Baker. La trompeta, en una cocina chica, es compañía suficiente.",
      ],
    },
  },
  {
    id: 151,
    category: "work",
    depth: "texture",
    en: "What did your first paycheck feel like? What did you do with it?",
    es: "¿Cómo se sintió tu primer cheque de pago? ¿Qué hiciste con él?",
    randomizeOptions: {
      en: [
        "Tres dólares y veinte centavos. Me sentí adulta. Le di dos a mami y compré un dulce con el resto.",
        "Sixty bucks. Felt like Rockefeller. Spent it on records I still have.",
        "A check small enough to embarrass me now. I split it three ways: rent, books, a meal alone at a real restaurant.",
        "The amount, by today's standards, was negligible; the dignity of having earned it was, in fact, immense.",
      ],
      es: [
        "Tres dólares y veinte centavos. Me sentí adulta. Le di dos a mami y compré un dulce con el resto.",
        "Sesenta dólares. Me sentí Rockefeller. Lo gasté en discos que aún tengo.",
        "Un cheque tan pequeño que ahora me da pena. Lo dividí en tres: renta, libros, una comida sola en un restaurante de verdad.",
        "La cantidad, según estándares de hoy, era insignificante; la dignidad de haberlo ganado fue, en efecto, inmensa.",
      ],
    },
  },
  {
    id: 152,
    category: "stories",
    depth: "texture",
    en: "Has something been stolen from you that you remember? What was it?",
    es: "¿Te robaron algo que recuerdes? ¿Qué fue?",
    randomizeOptions: {
      en: [
        "Una cadenita de mi mami. Me la quitaron en un autobús a los veintidós. Lloré como si me hubieran quitado a ella.",
        "Truck got broken into. Lost a tool kit my dad gave me. Madder about that than any other theft.",
        "A bicycle when I was twelve. Cried for a week. A neighbor gave me his old one. I haven't forgotten either of them.",
        "A volume of Yeats from a college library — I shall not say what stage of life I was in. The librarian, mercifully, never asked.",
      ],
      es: [
        "Una cadenita de mi mami. Me la quitaron en una guagua a los veintidós. Lloré como si me la hubieran quitado a ella.",
        "Me forzaron la camioneta. Perdí una caja de herramientas que me dio mi papá. Más enojado por eso que por cualquier otro robo.",
        "Una bicicleta a los doce. Lloré una semana. Un vecino me dio la suya vieja. No he olvidado ni una ni otro.",
        "Un volumen de Yeats de una biblioteca universitaria — no diré en qué etapa de vida estaba. El bibliotecario, misericordiosamente, nunca preguntó.",
      ],
    },
  },
  {
    id: 153,
    category: "family",
    depth: "texture",
    en: "Who was the quiet one in your house growing up? What were they thinking?",
    es: "¿Quién era el callado en tu casa? ¿En qué pensaba?",
    randomizeOptions: {
      en: [
        "Mi papá. Hablaba poco. Pensaba mucho en su madre, creo. Murió cuando él era niño.",
        "My old man. Whatever he was thinking, he didn't share it.",
        "My older brother. He read at the table. He was, I now understand, surviving us.",
        "My father. We have, in retrospect, theorized that he had been thinking, all those years, about a war he refused to discuss.",
      ],
      es: [
        "Mi papá. Hablaba poco. Pensaba mucho en su madre, creo. Murió cuando él era niño.",
        "Mi viejo. Lo que pensaba, no lo decía.",
        "Mi hermano mayor. Leía en la mesa. Estaba, ahora lo entiendo, sobreviviéndonos.",
        "Mi padre. Hemos teorizado, en retrospectiva, que pensaba, todos esos años, en una guerra que se negaba a discutir.",
      ],
    },
  },
  {
    id: 154,
    category: "childhood",
    depth: "depth",
    en: "Were you ever bullied? Did anyone step in?",
    es: "¿Te hicieron bullying alguna vez? ¿Alguien intervino?",
    randomizeOptions: {
      en: [
        "Una niña en la primaria me decía gorda. Mi prima Yoli la empujó. Nunca más me dijo nada.",
        "Got pushed around in seventh grade. Eddie stepped in. Owe him still.",
        "Yes. A teacher noticed without saying anything and quietly moved my seat. I have, since, paid that forward when I could.",
        "Briefly, in 1949. A particular nun, of some authority, intervened with a precision I admire to this day.",
      ],
      es: [
        "Una niña en la primaria me decía gorda. Mi prima Yoli la empujó. Nunca más me dijo nada.",
        "Me empujaron en séptimo grado. Eddie intervino. Aún se lo debo.",
        "Sí. Una maestra lo notó sin decir nada y, en silencio, me cambió de asiento. He pagado eso adelante cuando he podido.",
        "Brevemente, en 1949. Cierta monja, de alguna autoridad, intervino con una precisión que admiro hasta hoy.",
      ],
    },
  },
  {
    id: 155,
    category: "self",
    depth: "texture",
    en: "What's something you taught yourself, on your own, with no help?",
    es: "¿Qué cosa aprendiste por tu cuenta, sin ayuda?",
    randomizeOptions: {
      en: [
        "Aprendí a manejar el carro de Hector después de que murió. Me lo enseñé yo solita.",
        "How to weld. Bought a torch. Watched a guy at the shop. Figured it out.",
        "I taught myself to bake bread during a difficult winter. The first three loaves were inedible. The hundredth was good.",
        "Latin, at fourteen, with a borrowed grammar and excessive ambition. The grammar, I have since possessed; the ambition was, on balance, the more useful tool.",
      ],
      es: [
        "Aprendí a manejar el carro de Hector después de que murió. Me lo enseñé yo solita.",
        "A soldar. Compré un soplete. Vi a un cuate en el taller. Le agarré la onda.",
        "Me enseñé a hornear pan en un invierno difícil. Los primeros tres panes fueron incomibles. El número cien fue bueno.",
        "Latín, a los catorce, con una gramática prestada y ambición excesiva. La gramática, desde entonces, la he tenido; la ambición fue, en balance, la herramienta más útil.",
      ],
    },
  },
  {
    id: 156,
    category: "advice",
    depth: "depth",
    en: "When did you actually learn how to listen — not perform listening?",
    es: "¿Cuándo aprendiste a escuchar de verdad — no a actuar como que escuchabas?",
    randomizeOptions: {
      en: [
        "A los cuarenta. Mi mami me dijo: 'tú hablas mucho.' Era cierto. Empecé a callarme y a oír.",
        "Not till my fifties. Took losing somebody.",
        "Maybe in my thirties, when a friend of mine, dying, didn't want my advice — only my company.",
        "Around the age of forty-eight. I had, until then, been preparing my reply rather than receiving the speaker.",
      ],
      es: [
        "A los cuarenta. Mi mami me dijo: 'tú hablas mucho.' Era cierto. Empecé a callarme y a oír.",
        "Hasta los cincuenta. Me costó perder a alguien.",
        "Tal vez en mis treintas, cuando un amigo, muriéndose, no quería mi consejo — sólo mi compañía.",
        "Alrededor de los cuarenta y ocho. Había estado, hasta entonces, preparando mi respuesta en vez de recibir al que hablaba.",
      ],
    },
  },
  {
    id: 157,
    category: "family",
    depth: "texture",
    en: "Describe your mother's hands.",
    es: "Describe las manos de tu madre.",
    randomizeOptions: {
      en: [
        "Pequeñas. Suaves arriba, ásperas en las palmas. Olían a Pond's y a sofrito al mismo tiempo.",
        "Strong. Cracked in winter. A burn scar on the back from the iron.",
        "Long fingers, short nails, paper-thin skin in the last years. I held them at the end. I would know them anywhere.",
        "Slender, capable, perpetually cool to the touch. My mother could, with one hand, settle a room of children.",
      ],
      es: [
        "Pequeñas. Suaves arriba, ásperas en las palmas. Olían a Pond's y a sofrito al mismo tiempo.",
        "Fuertes. Agrietadas en invierno. Una cicatriz de quemadura por la plancha en el dorso.",
        "Dedos largos, uñas cortas, piel como papel en los últimos años. Las tomé al final. Las conocería en cualquier lugar.",
        "Esbeltas, capaces, perpetuamente frescas al tacto. Mi madre podía, con una sola mano, calmar un cuarto de niños.",
      ],
    },
  },
  {
    id: 158,
    category: "family",
    depth: "depth",
    en: "Tell me about a fight with your father — the kind that mattered.",
    es: "Cuéntame de una pelea con tu padre — de las que importan.",
    randomizeOptions: {
      en: [
        "Le dije que era injusto cuando me prohibió ir a un baile. Tenía dieciséis. Me dio una bofetada. Lloré tres días. Me pidió perdón. Aprendí a no callarme nunca más.",
        "Told him I wasn't going to be a mechanic. He didn't speak to me for a week. Then he came around.",
        "I told him, at twenty-five, that I would not be following him into the family business. He took it harder than I expected. We mended slowly.",
        "A disagreement, in 1962, about my refusal to attend a particular ceremony. He, eventually, conceded. I have, since, regretted only the noise of it.",
      ],
      es: [
        "Le dije que era injusto cuando me prohibió ir a un baile. Tenía dieciséis. Me dio una bofetada. Lloré tres días. Me pidió perdón. Aprendí a no callarme nunca más.",
        "Le dije que no iba a ser mecánico. No me habló una semana. Después se le pasó.",
        "Le dije, a los veinticinco, que no iba a seguirlo en el negocio familiar. Lo tomó peor de lo que esperaba. Nos reconciliamos despacio.",
        "Un desacuerdo, en 1962, sobre mi rechazo a asistir a cierta ceremonia. Él, eventualmente, cedió. He lamentado, desde entonces, sólo el ruido.",
      ],
    },
  },
  {
    id: 159,
    category: "love",
    depth: "depth",
    en: "Tell me about a kindness you gave that you've never told anyone about.",
    es: "Cuéntame de una bondad que diste y nunca le contaste a nadie.",
    randomizeOptions: {
      en: [
        "Le pagué la luz a una vecina dos veces sin que supiera. Ella todavía no sabe. Y así se queda.",
        "Helped a kid out of a jam. He doesn't know it was me. Don't want him to.",
        "Wrote a letter to a stranger I overheard talking about giving up. Mailed it without a return address. I think about her sometimes.",
        "Set, anonymously, a reluctant relative's tuition straight in 1978. He has not, in those decades, traced it to me. I prefer it that way.",
      ],
      es: [
        "Le pagué la luz a una vecina dos veces sin que supiera. Ella aún no sabe. Y así se queda.",
        "Le saqué a un chamaco de un problema. No sabe que fui yo. No quiero que sepa.",
        "Le escribí una carta a una desconocida que oí decir que se rendía. La mandé sin remitente. Pienso en ella a veces.",
        "Pagué, anónimamente, la matrícula de un pariente renuente en 1978. No lo ha rastreado, en esas décadas, hasta mí. Lo prefiero así.",
      ],
    },
  },
  {
    id: 160,
    category: "place",
    depth: "texture",
    en: "Tell me about a winter morning that mattered.",
    es: "Cuéntame de una mañana de invierno que importó.",
    randomizeOptions: {
      en: [
        "El primer invierno en Nueva York. Cinco grados. Mi nena de un año. La cargué bajo el abrigo. Caminamos a la iglesia.",
        "Morning Pop died. Light coming in. I sat at the kitchen table four hours. Didn't move.",
        "The first January after I moved out on my own — a quiet, blue cold, and a window thick with frost. I had never been so alone, or so unbothered.",
        "A morning in 1944, after a long-anticipated letter from overseas had arrived. The snow that day was, I believe, the most beautiful I have ever seen.",
      ],
      es: [
        "El primer invierno en Nueva York. Cinco grados. Mi nena de un año. La cargué bajo el abrigo. Caminamos a la iglesia.",
        "Mañana en que murió mi viejo. La luz entrando. Me senté en la mesa de la cocina cuatro horas. No me moví.",
        "El primer enero después de mudarme sola — un frío azul y silencioso, y una ventana cubierta de escarcha. Nunca había estado tan sola, ni tan tranquila.",
        "Una mañana en 1944, tras la llegada de una carta largamente esperada desde ultramar. La nieve ese día fue, creo, la más hermosa que he visto.",
      ],
    },
  },
  {
    id: 161,
    category: "love",
    depth: "texture",
    en: "Was there a friend's mother who really saw you, in the way your own couldn't always?",
    es: "¿Hubo una mamá de amigo que de verdad te viera, como no siempre podía la tuya?",
    randomizeOptions: {
      en: [
        "La mami de Mariana. Me trataba como a su propia hija. Yo iba allí para ser otra niña.",
        "Mrs. K., my buddy Eddie's mom. Made me a sandwich. Asked questions. That was a lot.",
        "My friend Beth's mother, who, without fanfare, treated me as if I were exactly enough. I think of her often.",
        "Mrs. Andrews, my grade-school friend's mother. She inquired, with care, about my interior life. No adult had previously done so.",
      ],
      es: [
        "La mami de Mariana. Me trataba como a su propia hija. Yo iba ahí para ser otra niña.",
        "Mrs. K., la mamá de mi cuate Eddie. Me hacía un sándwich. Me hacía preguntas. Era mucho.",
        "La madre de mi amiga Beth, que, sin aspavientos, me trataba como si yo fuera exactamente suficiente. Pienso en ella seguido.",
        "La señora Andrews, madre de mi amigo de la escuela. Preguntaba, con cuidado, por mi vida interior. Ningún adulto lo había hecho antes.",
      ],
    },
  },
  {
    id: 162,
    category: "childhood",
    depth: "texture",
    en: "Tell me about the last day of a summer you didn't want to end.",
    es: "Cuéntame del último día de un verano que no querías que terminara.",
    randomizeOptions: {
      en: [
        "Un domingo en Varadero. Mami me secaba el pelo en la playa. Le dije: 'no quiero que termine.' Ella dijo: 'mi vida, todo termina.'",
        "Last Saturday before sophomore year. Threw a baseball with my brother till it got too dark to see.",
        "The last August before college. We swam in a quarry. I wrote down what people said. I have the page still.",
        "The afternoon before I shipped out, in 1944. The corn was, that summer, particularly tall.",
      ],
      es: [
        "Un domingo en Varadero. Mami me secaba el pelo en la playa. Le dije: 'no quiero que termine.' Ella dijo: 'mi vida, todo termina.'",
        "El último sábado antes de segundo año. Tiré la pelota con mi hermano hasta que oscureció.",
        "El último agosto antes de la universidad. Nadamos en una cantera. Apunté lo que dijo la gente. Aún tengo la hoja.",
        "La tarde antes de embarcarme, en 1944. El maíz, ese verano, estaba particularmente alto.",
      ],
    },
  },
  {
    id: 163,
    category: "love",
    depth: "depth",
    en: "Have you ever fallen in love at first sight? Tell me honestly.",
    es: "¿Te has enamorado a primera vista? Sé honesto.",
    randomizeOptions: {
      en: [
        "Sí. Con Hector. En un baile. Cuando me agarró la mano para sacarme a bailar yo ya sabía.",
        "Once. Didn't last. Worth it.",
        "I'm not sure it was love at first sight, but I knew, in the first three minutes, that this was a person whose absence would be a problem.",
        "I should not, by training or temperament, believe in such things. Nevertheless, in 1957, I did.",
      ],
      es: [
        "Sí. Con Hector. En un baile. Cuando me agarró la mano para sacarme a bailar yo ya sabía.",
        "Una vez. No duró. Valió la pena.",
        "No estoy segura de que fuera amor a primera vista, pero supe, en los primeros tres minutos, que era una persona cuya ausencia sería un problema.",
        "No debería, por formación ni por temperamento, creer en tales cosas. Sin embargo, en 1957, lo hice.",
      ],
    },
  },
  {
    id: 164,
    category: "love",
    depth: "texture",
    en: "Describe the smell of someone you've loved.",
    es: "Describe el olor de alguien a quien amaste.",
    randomizeOptions: {
      en: [
        "Hector. Old Spice y café. A veces todavía lo huelo en alguna parte y me detengo.",
        "Wife. Detergent and her shampoo. Don't have the words for the rest.",
        "Coffee on his neck. Specific paperback dust. Cold air on his coat. I could find him in a stadium.",
        "The faint, dignified perfume my late wife wore. I have not, in seven years, opened the bottle.",
      ],
      es: [
        "Hector. Old Spice y café. A veces todavía lo huelo en alguna parte y me paro.",
        "Mi esposa. Detergente y su champú. No tengo palabras para el resto.",
        "Café en su cuello. Polvo específico de libros de bolsillo. Aire frío en su abrigo. Lo encontraría en un estadio.",
        "El perfume tenue, digno, que usaba mi difunta esposa. No he abierto el frasco, en siete años.",
      ],
    },
  },
  {
    id: 165,
    category: "self",
    depth: "texture",
    en: "How do you actually wind down at night? Honest version, not the magazine version.",
    es: "¿Cómo te relajas de verdad por la noche? La versión honesta, no la de revista.",
    randomizeOptions: {
      en: [
        "Pijama, novela, te y rezo el rosario hasta dormirme. A veces el rosario gana, a veces la novela.",
        "TV until I pass out. Don't pretend.",
        "I scroll for too long, feel guilty, read for ten minutes, sleep. The pattern is consistent.",
        "I sit with a small whiskey and the day's mail. The ritual, after fifty years, has not lost its dignity.",
      ],
      es: [
        "Pijama, novela, té, y rezo el rosario hasta dormirme. A veces gana el rosario, a veces la novela.",
        "Tele hasta que me caigo. No finjo.",
        "Hago scroll demasiado tiempo, me siento mal, leo diez minutos, duermo. El patrón es consistente.",
        "Me siento con un whisky pequeño y la correspondencia del día. El ritual, tras cincuenta años, no ha perdido la dignidad.",
      ],
    },
  },
  {
    id: 166,
    category: "love",
    depth: "texture",
    en: "Tell me about a gift you gave that absolutely landed.",
    es: "Cuéntame de un regalo que diste y que dio en el blanco.",
    randomizeOptions: {
      en: [
        "Le di a mi nieta el rosario de su bisabuela. Lloró. La abracé. No hubo más.",
        "Got my buddy a tool he'd wanted ten years. Said nothing. Used it the next day.",
        "Bought my mother a record she'd loved as a girl, on her seventieth. She put it on at the party and pulled my father onto the floor.",
        "I once arranged for the quiet dispatch of a particular book to a friend in distress. He has, in conversation, alluded to it without my ever owning the deed.",
      ],
      es: [
        "Le di a mi nieta el rosario de su bisabuela. Lloró. La abracé. No hubo más.",
        "Le di a un cuate una herramienta que llevaba diez años queriendo. No dijo nada. La usó al día siguiente.",
        "Le compré a mi madre un disco que había amado de niña, en sus setenta años. Lo puso en la fiesta y sacó a mi padre a bailar.",
        "Arreglé, alguna vez, el envío callado de cierto libro a un amigo en aprietos. Lo ha aludido en conversación sin que yo haya reconocido nunca el acto.",
      ],
    },
  },
  {
    id: 167,
    category: "stories",
    depth: "texture",
    en: "Tell me about a gift you gave that completely missed.",
    es: "Cuéntame de un regalo que diste y falló por completo.",
    randomizeOptions: {
      en: [
        "Le compré una blusa a mi suegra. Le quedó chica. Su cara me mata todavía. Me reí dos años después.",
        "Bought my brother a jacket. Wrong color. Wrong everything. Wears it once a year out of mercy.",
        "A book I loved that my friend, politely, hated. We laughed about it later. Now I ask before I gift books.",
        "A piece of small statuary, in 1969, that my then-fiancée found unaccountably alarming. She has, in years since, set it discreetly behind a plant.",
      ],
      es: [
        "Le compré una blusa a mi suegra. Le quedó chica. Su cara me mata todavía. Me reí dos años después.",
        "Le compré una chaqueta a mi hermano. Color equivocado. Todo equivocado. La usa una vez al año por compasión.",
        "Un libro que yo amaba y que mi amigo, cortésmente, odió. Nos reímos después. Ahora pregunto antes de regalar libros.",
        "Una pequeña pieza de escultura, en 1969, que mi entonces prometida halló inexplicablemente alarmante. Ella la ha colocado, en los años siguientes, discretamente detrás de una planta.",
      ],
    },
  },
  {
    id: 168,
    category: "stories",
    depth: "depth",
    en: "Tell me about a moment when someone showed you mercy you didn't deserve.",
    es: "Cuéntame de un momento en que alguien fue clemente contigo aunque no lo merecías.",
    randomizeOptions: {
      en: [
        "Mami, cuando rompí su jarrón favorito a los diez. Me esperaba un castigo y sólo me dijo: 'limpia.' Y me abrazó.",
        "Boss who didn't fire me when he should've. Worked twice as hard the next year.",
        "A friend who forgave me before I'd finished apologizing. I learned more about grace from her than from any sermon.",
        "A teacher, in 1957, who declined to penalize a transgression he had every right to punish. I have, in his memory, tried to do the same.",
      ],
      es: [
        "Mami, cuando rompí su jarrón favorito a los diez. Esperaba castigo y sólo me dijo: 'limpia.' Y me abrazó.",
        "Un jefe que no me corrió cuando debió. Trabajé el doble el año siguiente.",
        "Una amiga que me perdonó antes de que terminara de pedir perdón. Aprendí más sobre la gracia con ella que con ningún sermón.",
        "Un maestro, en 1957, que declinó castigar una transgresión que tenía todo el derecho de castigar. He intentado, en su memoria, hacer lo mismo.",
      ],
    },
  },
  {
    id: 169,
    category: "family",
    depth: "depth",
    en: "Was there a cousin who became a stranger? What happened?",
    es: "¿Hubo un primo que se volvió un desconocido? ¿Qué pasó?",
    randomizeOptions: {
      en: [
        "Mi prima Yoli. Crecimos juntas. Se mudó a España y dejé de saber de ella. La extraño cada Nochebuena.",
        "Cousin Ray. Drifted after my uncle died. Don't know him anymore. Don't know if he wants to be known.",
        "A cousin who lived two streets over. We were inseparable; I no longer have her number. I think we both let it happen, by inches.",
        "My second cousin Walter, who, after a single disagreement in 1968, declined ever to address me again. The distance is, by now, an artifact.",
      ],
      es: [
        "Mi prima Yoli. Crecimos juntas. Se mudó a España y dejé de saber de ella. La extraño cada Nochebuena.",
        "Mi primo Ray. Se alejó cuando murió mi tío. Ya no lo conozco. No sé si quiere ser conocido.",
        "Una prima que vivía a dos calles. Éramos inseparables; ya no tengo su número. Creo que las dos lo dejamos pasar, a fuerza de centímetros.",
        "Mi primo segundo Walter, que, tras un único desacuerdo en 1968, se negó a dirigirme la palabra de nuevo. La distancia es, a estas alturas, un artefacto.",
      ],
    },
  },
  {
    id: 170,
    category: "work",
    depth: "depth",
    en: "Tell me about work you did that nobody saw.",
    es: "Cuéntame de un trabajo que hiciste que nadie vio.",
    randomizeOptions: {
      en: [
        "Cuidé a mi suegra los últimos dos años. Nadie sabe lo que es. Yo lo sé.",
        "Cleaned out the shop after my old man retired. Three weeks. Didn't tell anyone.",
        "I helped a coworker keep up with her mother's medication schedule for half a year. She thought she was hiding it. She wasn't.",
        "A great deal of organizing of my late wife's papers, after she went, in a study only I would ever enter. The work was its own consolation.",
      ],
      es: [
        "Cuidé a mi suegra los últimos dos años. Nadie sabe lo que es. Yo sí.",
        "Limpié el taller después de que mi viejo se jubiló. Tres semanas. No le dije a nadie.",
        "Le ayudé a una compañera de trabajo a llevar el horario de las medicinas de su madre durante medio año. Ella pensaba que lo escondía. No lo hacía.",
        "Mucho ordenamiento de los papeles de mi difunta esposa, después de que se fue, en un estudio al que sólo yo entraría. El trabajo fue su propio consuelo.",
      ],
    },
  },
  {
    id: 171,
    category: "stories",
    depth: "texture",
    en: "Tell me about a wedding you remember, that wasn't yours.",
    es: "Cuéntame de una boda que recuerdas, que no fue la tuya.",
    randomizeOptions: {
      en: [
        "La de mi sobrina Sofía. Bailamos cinco horas. Ella lloró cuando le entregué su ramo.",
        "Cousin's wedding. Drank too much. Said something nice in the toast and meant it.",
        "A friend's, on a hilltop, in October. The light was unfair to everyone except the bride. We danced till the lights came on.",
        "A small ceremony in 1975 — no music, no flowers, two friends and a justice of the peace. The most luminous wedding I have attended.",
      ],
      es: [
        "La de mi sobrina Sofía. Bailamos cinco horas. Ella lloró cuando le entregué su ramo.",
        "Boda de un primo. Tomé de más. Dije algo bonito en el brindis y lo dije en serio.",
        "La de una amiga, en una colina, en octubre. La luz no era justa con nadie excepto la novia. Bailamos hasta que prendieron las luces.",
        "Una ceremonia pequeña en 1975 — sin música, sin flores, dos amigos y un juez de paz. La boda más luminosa a la que he asistido.",
      ],
    },
  },
  {
    id: 172,
    category: "stories",
    depth: "texture",
    en: "Tell me about a wedding you'd skip, if you could've.",
    es: "Cuéntame de una boda a la que hubieras faltado si hubieras podido.",
    randomizeOptions: {
      en: [
        "La de un primo lejano. Cuatro horas en la iglesia. El aire no servía. Yo con tacones nuevos.",
        "Coworker's. Knew it wasn't going to last. Didn't say so. Bought the gravy boat.",
        "A college friend's, two years before the divorce. I knew. Everyone knew. We danced anyway.",
        "A wedding, in 1973, attended out of strict obligation, the bride and groom of which had each, separately, communicated reservations to me. The ceremony was, predictably, brief.",
      ],
      es: [
        "La de un primo lejano. Cuatro horas en la iglesia. El aire no servía. Yo con tacones nuevos.",
        "Boda de un compañero de trabajo. Sabía que no iba a durar. No lo dije. Compré la salsera.",
        "La de un amigo de la universidad, dos años antes del divorcio. Yo sabía. Todos sabíamos. Bailamos igual.",
        "Una boda, en 1973, a la que asistí por estricta obligación, cuyos novios, por separado, me habían comunicado reservas. La ceremonia fue, previsiblemente, breve.",
      ],
    },
  },
  {
    id: 173,
    category: "stories",
    depth: "texture",
    en: "Tell me about a child who wasn't yours that you remember holding.",
    es: "Cuéntame de un niño que no era tuyo y a quien recuerdas haber cargado.",
    randomizeOptions: {
      en: [
        "El bebé de mi vecina, recién nacido. Lo cargué dos minutos. Se durmió. Yo casi también.",
        "Buddy's kid. Couldn't have been ten pounds. Held him with one arm. Cried later in the truck.",
        "A friend's newborn at a hospital. The weight of the head in my hand was theological. I have not, since, fully recovered.",
        "My great-niece, in 2006, when she was three days old. The smell of the top of her head was, on that day, the entire universe.",
      ],
      es: [
        "El bebé de mi vecina, recién nacido. Lo cargué dos minutos. Se durmió. Yo casi también.",
        "El hijo de un cuate. No pesaba ni cinco kilos. Lo cargué con un brazo. Lloré después en la camioneta.",
        "El recién nacido de una amiga en un hospital. El peso de la cabecita en mi mano era teología. No me he recuperado del todo, desde entonces.",
        "Mi sobrina nieta, en 2006, cuando tenía tres días de nacida. El olor de su cabecita fue, ese día, el universo entero.",
      ],
    },
  },
  {
    id: 174,
    category: "stories",
    depth: "texture",
    en: "Did a teacher ever make a mistake about you, and how did it shape you?",
    es: "¿Algún maestro se equivocó contigo, y cómo te marcó?",
    randomizeOptions: {
      en: [
        "Una maestra dijo que yo no era buena en matemáticas. Le creí veinte años. Después saqué un grado en contabilidad.",
        "Coach said I'd never make varsity. Made it. Quit two years later anyway. Still proud.",
        "A teacher told me I 'wasn't a writer.' I rejected the verdict, slowly. The slow rejection became most of my twenties.",
        "A particular master at the boys' school, in 1949, predicted I would not amount to much. I have, with some satisfaction, declined to oblige him.",
      ],
      es: [
        "Una maestra dijo que yo no era buena en matemáticas. Le creí veinte años. Después saqué un grado en contabilidad.",
        "El entrenador dijo que no entraba al equipo. Entré. Lo dejé dos años después igual. Aún orgulloso.",
        "Un maestro me dijo que 'no era escritor.' Rechacé el veredicto, despacio. El rechazo lento se volvió la mayor parte de mis veintes.",
        "Un maestro particular en la escuela de varones, en 1949, predijo que yo no llegaría a gran cosa. He, con cierta satisfacción, declinado complacerlo.",
      ],
    },
  },
  {
    id: 175,
    category: "self",
    depth: "depth",
    en: "What does a quiet morning in your sixties or seventies feel like, that the younger you couldn't have imagined?",
    es: "¿Cómo se siente una mañana tranquila en tus sesentas o setentas, que tu yo más joven no hubiera podido imaginar?",
    randomizeOptions: {
      en: [
        "Sentirme bien sin ruido. Sin gente alrededor. Sin necesitar nada. Eso a los veinte hubiera sido aburrido. Ahora es la felicidad.",
        "Mornings I used to dread are the best part of the day now. Quiet, slow, mine.",
        "It feels like sitting next to someone you've known forever, in companionable silence, except the someone is yourself.",
        "An unhurried lucidity, the gift of a working body, and a cup of coffee that I have, after all these years, finally learned to make exactly.",
      ],
      es: [
        "Sentirme bien sin ruido. Sin gente alrededor. Sin necesitar nada. A los veinte eso hubiera sido aburrido. Ahora es felicidad.",
        "Mañanas que antes odiaba ahora son la mejor parte del día. Tranquilas, lentas, mías.",
        "Se siente como sentarse junto a alguien que conoces desde siempre, en silencio cómodo, salvo que ese alguien eres tú mismo.",
        "Una lucidez sin prisa, el regalo de un cuerpo que funciona, y una taza de café que, después de todos estos años, por fin he aprendido a hacer exactamente.",
      ],
    },
  },

  // — Batch 7 (176–205) —
  {
    id: 176,
    category: "family",
    depth: "texture",
    en: "What was a meal in your childhood that meant something special — birthday, Sunday, anything?",
    es: "¿Qué comida de tu niñez significaba algo especial — cumpleaños, domingo, lo que sea?",
    randomizeOptions: {
      en: [
        "Mami hacía arroz con pollo cada domingo. Mi tío venía. Mi papá ponía la radio. Eso era la semana.",
        "Pot roast on Sundays. Lasted three days. Best on day two.",
        "My birthday meal was my grandmother's cinnamon toast and tea. I still order it when I'm sick.",
        "Roast beef on Sundays, by my mother, with horseradish she grated by hand. The kitchen, those afternoons, was a country.",
      ],
      es: [
        "Mami hacía arroz con pollo cada domingo. Mi tío venía. Mi papá ponía la radio. Eso era la semana.",
        "Asado los domingos. Duraba tres días. Mejor al segundo.",
        "Mi comida de cumpleaños era el pan tostado con canela y té de mi abuela. Aún lo pido cuando estoy enferma.",
        "Carne asada los domingos, hecha por mi madre, con rábano picante que ella rallaba a mano. La cocina, esas tardes, era un país.",
      ],
    },
  },
  {
    id: 177,
    category: "self",
    depth: "texture",
    en: "What does your kitchen look like when no one's coming over?",
    es: "¿Cómo se ve tu cocina cuando no viene nadie?",
    randomizeOptions: {
      en: [
        "Limpia. Una cafetera siempre lista. Una vela. Las recetas de mi mami pegadas con cinta.",
        "Counter's got a coffee maker, a toolbox, and the mail. Don't judge.",
        "A pile of cookbooks, a single mug in the sink, a pothos that has refused to die for nine years.",
        "Spare. A row of cookbooks, a teakettle, the morning paper. The kitchen, like its proprietor, prefers a small footprint.",
      ],
      es: [
        "Limpia. Una cafetera siempre lista. Una vela. Las recetas de mi mami pegadas con cinta.",
        "En la encimera hay una cafetera, una caja de herramientas y la correspondencia. No juzgues.",
        "Una pila de libros de cocina, una sola taza en el fregadero, una potos que se ha negado a morirse en nueve años.",
        "Sobria. Una hilera de libros de cocina, una tetera, el periódico de la mañana. La cocina, como su propietario, prefiere una huella pequeña.",
      ],
    },
  },
  {
    id: 178,
    category: "stories",
    depth: "texture",
    en: "Have you ever traveled alone? What did you find out about yourself?",
    es: "¿Has viajado sola/solo? ¿Qué descubriste de ti?",
    randomizeOptions: {
      en: [
        "Una vez fui a México sola, a los cuarenta. Nadie me esperaba. Me di cuenta de que me caigo bien.",
        "Drove cross-country once. Six days. Found out I like my own company.",
        "A week in Lisbon at twenty-nine. Discovered that I'm not, after all, lonely the way I'd been told I was.",
        "A walking tour in 1968, undertaken with a knapsack and excessive optimism. I found I was, on long roads, perfectly good company for myself.",
      ],
      es: [
        "Una vez fui a México sola, a los cuarenta. Nadie me esperaba. Me di cuenta de que me caigo bien.",
        "Manejé costa a costa una vez. Seis días. Descubrí que me llevo bien conmigo.",
        "Una semana en Lisboa a los veintinueve. Descubrí que, después de todo, no soy la persona solitaria que me habían dicho que era.",
        "Un viaje a pie en 1968, emprendido con una mochila y optimismo excesivo. Descubrí que era, en caminos largos, excelente compañía para mí mismo.",
      ],
    },
  },
  {
    id: 179,
    category: "self",
    depth: "texture",
    en: "What still gives you butterflies, at this age?",
    es: "¿Qué te sigue dando mariposas en el estómago, a tu edad?",
    randomizeOptions: {
      en: [
        "Cuando una nieta me llama y me dice 'abuela.' Cada vez. Setenta y dos años y todavía.",
        "Hearing my wife laugh in the next room. Every damn time.",
        "Opening a new book. The first paragraph. Even now.",
        "An impending lecture, even after fifty years of giving them. The body, evidently, knows what to attend to.",
      ],
      es: [
        "Cuando una nieta me llama y me dice 'abuela.' Cada vez. Setenta y dos años y todavía.",
        "Oír reír a mi esposa en el otro cuarto. Cada vez.",
        "Abrir un libro nuevo. El primer párrafo. Aun ahora.",
        "Una conferencia inminente, después de cincuenta años de darlas. El cuerpo, evidentemente, sabe a qué prestar atención.",
      ],
    },
  },
  {
    id: 180,
    category: "self",
    depth: "depth",
    en: "If you were headed into surgery, what would you want around you?",
    es: "Si fueras a entrar a una cirugía, ¿qué quisieras tener cerca?",
    randomizeOptions: {
      en: [
        "Mi rosario, una foto de mis nietos, y la mano de mi hija agarrando la mía.",
        "My wife. Quiet. No talking.",
        "A specific scarf my mother left me, my partner reading aloud, and the smell of fresh coffee in the hallway.",
        "A small Bible inherited from my grandfather, my wife's hand, and the assurance, however inferred, that the surgeon had had a decent breakfast.",
      ],
      es: [
        "Mi rosario, una foto de mis nietos, y la mano de mi hija agarrando la mía.",
        "Mi esposa. Callada. Sin hablar.",
        "Un pañuelo específico que me dejó mi madre, mi pareja leyéndome en voz alta, y el olor a café recién hecho en el pasillo.",
        "Una Biblia pequeña heredada de mi abuelo, la mano de mi esposa, y la garantía, deducida como pueda, de que el cirujano había desayunado decentemente.",
      ],
    },
  },
  {
    id: 181,
    category: "stories",
    depth: "depth",
    en: "Was there a coach or mentor who saw what nobody else did?",
    es: "¿Hubo un entrenador o mentor que vio lo que nadie más vio?",
    randomizeOptions: {
      en: [
        "Doña Marta, mi profesora de canto. Me dijo: 'tú tienes algo.' Yo no le creí. Pero me lo dijo, y eso bastó por años.",
        "Coach Reilly. Saw I was scared. Didn't push me. Just kept showing up. So did I.",
        "A speech professor, third year of college, who said, \"Stop apologizing before you talk.\" I have not, since, fully apologized for being in a room.",
        "A retired colleague, who, in 1971, told me my early work was \"undeveloped but unmistakable.\" The phrase has, for fifty-four years, been a private compass.",
      ],
      es: [
        "Doña Marta, mi profesora de canto. Me dijo: 'tú tienes algo.' Yo no le creí. Pero me lo dijo, y eso bastó por años.",
        "El entrenador Reilly. Vio que yo tenía miedo. No me presionó. Sólo siguió apareciendo. Yo también.",
        "Una profesora de oratoria, tercer año de universidad, que dijo: \"Deja de pedir perdón antes de hablar.\" No he, desde entonces, pedido perdón completamente por estar en un cuarto.",
        "Un colega jubilado, que, en 1971, me dijo que mi trabajo temprano era \"sin desarrollar pero inconfundible.\" La frase ha sido, durante cincuenta y cuatro años, una brújula privada.",
      ],
    },
  },
  {
    id: 182,
    category: "childhood",
    depth: "texture",
    en: "How did you learn to swim — and was it scary?",
    es: "¿Cómo aprendiste a nadar — y dio miedo?",
    randomizeOptions: {
      en: [
        "Mi papá me cargó en el mar. 'Si te suelto, te ahogas, y mami me mata.' No me soltó. Aprendí.",
        "Old man pushed me off a dock at six. Sink or swim, in that order. I figured it out.",
        "I learned at the YMCA. Patient instructor. Took me two summers. The fear lasted longer than the lessons did.",
        "Slowly, in 1937, in a lake in upstate New York. The fear has, in fact, never entirely subsided; my respect for water remains, on balance, sound.",
      ],
      es: [
        "Mi papá me cargó en el mar. 'Si te suelto, te ahogas, y mami me mata.' No me soltó. Aprendí.",
        "Mi viejo me empujó del muelle a los seis. Hundirse o nadar, en ese orden. Resolví.",
        "Aprendí en la YMCA. Instructor paciente. Me tomó dos veranos. El miedo duró más que las clases.",
        "Despacio, en 1937, en un lago al norte de Nueva York. El miedo, en realidad, nunca ha cedido del todo; mi respeto por el agua sigue siendo, en balance, sano.",
      ],
    },
  },
  {
    id: 183,
    category: "self",
    depth: "depth",
    en: "Tell me about the first time you stood up for yourself.",
    es: "Cuéntame de la primera vez que te defendiste.",
    randomizeOptions: {
      en: [
        "A los catorce. Le dije a mi tío que no me hablara así nunca más. Me temblaba la voz. Pero lo dije.",
        "Confronted my dad about something he'd done. Twenty-two. He didn't apologize. Doesn't matter. I said it.",
        "I told a roommate at twenty-five to stop borrowing without asking. The conversation cost me sleep. The next year, I slept better.",
        "I declined, at thirty-one, to attend a dinner I had attended for years out of obligation. The relief was, on the whole, considerable.",
      ],
      es: [
        "A los catorce. Le dije a mi tío que no me hablara así nunca más. Me temblaba la voz. Pero lo dije.",
        "Confronté a mi papá por algo que había hecho. Veintidós. No pidió perdón. No importa. Lo dije.",
        "Le dije a una compañera de cuarto, a los veinticinco, que dejara de tomar mis cosas sin pedir. La conversación me costó el sueño. El año siguiente dormí mejor.",
        "Decliné, a los treinta y uno, asistir a una cena a la que había asistido por años por obligación. El alivio fue, en general, considerable.",
      ],
    },
  },
  {
    id: 184,
    category: "self",
    depth: "surface",
    en: "What's a joke or one-liner of yours that always gets a groan or a laugh?",
    es: "¿Cuál es un chiste o frase tuya que siempre saca risa o queja?",
    randomizeOptions: {
      en: [
        "Le digo a mi marido cuando algo no funciona: 'Eso es un milagro, pero al revés.' A los nietos les encanta.",
        "\"How's it going? — going.\" Says it all.",
        "I do this thing where I say \"Well, that's a problem for tomorrow's [name]\" — sometimes my own. Always lands.",
        "I have, in my repertoire, a Latin quip about Caesar that has, on three separate continents, been enjoyed by approximately one person.",
      ],
      es: [
        "Le digo a mi marido cuando algo no funciona: 'Eso es un milagro, pero al revés.' A los nietos les encanta.",
        "\"¿Cómo vas? — voy.\" Lo dice todo.",
        "Hago esa cosa de decir \"bueno, ese es un problema del [nombre] de mañana\" — a veces el mío. Siempre pega.",
        "Tengo, en mi repertorio, una agudeza en latín sobre César que, en tres continentes distintos, ha sido apreciada por aproximadamente una persona.",
      ],
    },
  },
  {
    id: 185,
    category: "self",
    depth: "surface",
    en: "Is there an app you delete and re-download on a cycle? Why?",
    es: "¿Hay una app que borras y vuelves a bajar en ciclos? ¿Por qué?",
    randomizeOptions: {
      en: [
        "Facebook. Lo borro cuando me pone triste y lo bajo cuando extraño a mis primos.",
        "Twitter. Or X. Or whatever. Stupid. Keep coming back.",
        "Instagram. I leave it for a month, miss seeing my friends' kids, return, regret it within a week.",
        "I do not, in fact, have one — I find the smartphone, on the whole, an interruption to better forms of attention.",
      ],
      es: [
        "Facebook. Lo borro cuando me pone triste y lo bajo cuando extraño a mis primos.",
        "Twitter. O X. O lo que sea. Tonto. Sigo regresando.",
        "Instagram. La quito un mes, extraño ver a los hijos de mis amigos, vuelvo, me arrepiento en una semana.",
        "No tengo, de hecho, ninguna — encuentro el teléfono inteligente, en general, una interrupción a mejores formas de atención.",
      ],
    },
  },
  {
    id: 186,
    category: "self",
    depth: "texture",
    en: "What ritual do you keep — daily, weekly, yearly — without fail?",
    es: "¿Qué ritual sigues — diario, semanal, anual — sin falla?",
    randomizeOptions: {
      en: [
        "Misa los domingos. Cuarenta y cuatro años. Aunque llueva. Aunque esté enferma.",
        "Sunday paper. Two hours. Pancakes after.",
        "A long Saturday walk, alone, the same loop, regardless of weather. It's the spine of my week.",
        "An annual reread, in early autumn, of one specific novel, the choice of which I will not, on this occasion, disclose.",
      ],
      es: [
        "Misa los domingos. Cuarenta y cuatro años. Aunque llueva. Aunque esté enferma.",
        "El periódico del domingo. Dos horas. Hot cakes después.",
        "Una caminata larga el sábado, sola, el mismo circuito, sin importar el clima. Es la columna de mi semana.",
        "Una relectura anual, a principios del otoño, de una novela específica, cuya elección no, en esta ocasión, divulgaré.",
      ],
    },
  },
  {
    id: 187,
    category: "stories",
    depth: "depth",
    en: "What was the last argument that actually mattered? Did it change anything?",
    es: "¿Cuál fue la última discusión que de verdad importó? ¿Cambió algo?",
    randomizeOptions: {
      en: [
        "Con mi hija, sobre cómo cuidarme cuando me enferme. Me dolió. Me ayudó. Las dos cambiamos.",
        "Wife and me, about money. Twenty minutes. Both right, both wrong. Slept on it. Fine in the morning.",
        "A friend and I, about how to grieve. We disagreed kindly. We still do.",
        "A debate, last autumn, with a colleague half my age, about a matter of small consequence. He was correct. I have, in private, conceded.",
      ],
      es: [
        "Con mi hija, sobre cómo cuidarme cuando me enferme. Me dolió. Me ayudó. Las dos cambiamos.",
        "Mi esposa y yo, sobre dinero. Veinte minutos. Las dos teníamos razón, las dos estábamos mal. Dormimos. En la mañana, bien.",
        "Una amiga y yo, sobre cómo hacer duelo. No estuvimos de acuerdo, con cariño. Seguimos sin estarlo.",
        "Un debate, el otoño pasado, con un colega de la mitad de mi edad, sobre un asunto de poca consecuencia. Tenía razón. He, en privado, reconocido.",
      ],
    },
  },
  {
    id: 188,
    category: "stories",
    depth: "texture",
    en: "Tell me about a found object you kept — picked up off a sidewalk, a beach, anywhere.",
    es: "Cuéntame de un objeto que te encontraste y guardaste — en la banqueta, en la playa, en cualquier parte.",
    randomizeOptions: {
      en: [
        "Una concha pequeñita en Varadero. Tenía siete años. La sigo teniendo. Al lado de mi cama.",
        "Found a Vietnam-era dog tag at a yard sale. Tried for years to find the family. Failed. Still mine.",
        "A pressed leaf I picked up the day I moved to a new city. Twenty-three years ago. It's in a book I never reread.",
        "A small smooth stone from a beach in Brittany, 1972. It has, since, ridden a great many pockets.",
      ],
      es: [
        "Una conchita en Varadero. Tenía siete años. Aún la tengo. Al lado de mi cama.",
        "Una placa de identificación de la era de Vietnam, en una venta de garaje. Intenté años encontrar a la familia. Fallé. Sigue siendo mía.",
        "Una hoja prensada que recogí el día que me mudé a una ciudad nueva. Hace veintitrés años. Está en un libro que no releo.",
        "Una piedra pequeña y lisa de una playa en Bretaña, 1972. Ha viajado, desde entonces, en muchísimos bolsillos.",
      ],
    },
  },
  {
    id: 189,
    category: "self",
    depth: "depth",
    en: "What's a strength of yours that no one would guess just looking at you?",
    es: "¿Qué fuerza tienes que nadie adivinaría con sólo verte?",
    randomizeOptions: {
      en: [
        "Que aguanto. Hector decía que yo era 'piedra con corazón.' Era verdad.",
        "Patience. Don't look it. Have it.",
        "I can sit with someone in pain without trying to fix them. Took years. Most people can't tell.",
        "An ability, perhaps inconveniently, to read silences. The skill is, on the whole, less helpful than one might think.",
      ],
      es: [
        "Que aguanto. Hector decía que yo era 'piedra con corazón.' Era verdad.",
        "Paciencia. No la aparento. La tengo.",
        "Puedo estar con alguien en dolor sin intentar arreglarlo. Me tomó años. La mayoría no se da cuenta.",
        "Una habilidad, tal vez inconveniente, de leer los silencios. La destreza es, en general, menos útil de lo que uno pensaría.",
      ],
    },
  },
  {
    id: 190,
    category: "stories",
    depth: "texture",
    en: "What was your first concert? Were you alone or with someone?",
    es: "¿Cuál fue tu primer concierto? ¿Fuiste sola/solo o con alguien?",
    randomizeOptions: {
      en: [
        "Olga Guillot, en La Habana. Iba con mi mami. Lloré con cada bolero. Yo tenía catorce.",
        "Springsteen, '85. Went with three friends. Lost my voice for two days.",
        "Joni Mitchell, in a small theatre at twenty. I went alone. I have, since, never doubted that solitude is acceptable in public.",
        "A small chamber recital at a college chapel, 1953. The Brahms, on that night, ruined and remade me in roughly equal measure.",
      ],
      es: [
        "Olga Guillot, en La Habana. Iba con mi mami. Lloré con cada bolero. Yo tenía catorce.",
        "Springsteen, en el 85. Con tres amigos. Perdí la voz dos días.",
        "Joni Mitchell, en un teatro chico, a los veinte. Fui sola. No he dudado, desde entonces, que la soledad es aceptable en público.",
        "Un pequeño recital de cámara en una capilla universitaria, 1953. El Brahms, esa noche, me arruinó y me rehízo en proporciones aproximadamente iguales.",
      ],
    },
  },
  {
    id: 191,
    category: "stories",
    depth: "texture",
    en: "Tell me about the first time you got on a plane.",
    es: "Cuéntame de la primera vez que te subiste a un avión.",
    randomizeOptions: {
      en: [
        "El vuelo de Cuba a Miami. Tenía veintidós años. No lloré. No comí. Llegué con la cara de piedra.",
        "First flight was in the Air Force. Don't recommend it as your first.",
        "First time I flew was at twenty-six, to a job interview. I was so nervous I read the safety card three times.",
        "1947, on a propeller flight to attend a wedding. The ride was, on balance, more dramatic than the ceremony.",
      ],
      es: [
        "El vuelo de Cuba a Miami. Tenía veintidós años. No lloré. No comí. Llegué con cara de piedra.",
        "Mi primer vuelo fue en la Fuerza Aérea. No lo recomiendo como primer vuelo.",
        "La primera vez que volé fue a los veintiséis, para una entrevista. Estaba tan nervioso que leí la tarjeta de seguridad tres veces.",
        "1947, en un vuelo de hélice para asistir a una boda. El viaje fue, en balance, más dramático que la ceremonia.",
      ],
    },
  },
  {
    id: 192,
    category: "stories",
    depth: "depth",
    en: "Tell me about a moment of total confidence — when you knew, exactly, what you were doing.",
    es: "Cuéntame de un momento de confianza total — cuando sabías, con exactitud, lo que hacías.",
    randomizeOptions: {
      en: [
        "Cuando dí a luz a mi hija. En mitad del dolor, supe lo que hacía. Mi cuerpo sabía.",
        "Driving my old man to the hospital. Knew every turn. Drove like I was made for it.",
        "On a stage giving a talk I had prepared for a decade. I knew my material; I, briefly, knew myself.",
        "A surgical decision, or its analogue, in a meeting in 1979 that I will not specify. I knew. I acted. The act was correct.",
      ],
      es: [
        "Cuando di a luz a mi hija. En medio del dolor, supe lo que hacía. Mi cuerpo sabía.",
        "Manejando a mi viejo al hospital. Conocía cada vuelta. Manejé como si hubiera nacido para eso.",
        "En un escenario dando una charla que había preparado por una década. Conocía mi material; brevemente, me conocí.",
        "Una decisión quirúrgica, o su análoga, en una junta en 1979 que no especificaré. Lo supe. Actué. El acto fue correcto.",
      ],
    },
  },
  {
    id: 193,
    category: "self",
    depth: "texture",
    en: "Is there a place where they know your order? Where, and what is it?",
    es: "¿Hay un lugar donde saben tu pedido? ¿Cuál y qué es?",
    randomizeOptions: {
      en: [
        "La cafetería en la esquina. Café cortado, una empanada de carne. Doña Lupe ya no me pregunta.",
        "Diner near the shop. Two eggs over easy, hash browns. Coffee black. They know.",
        "A little café where I spent my late twenties. The barista now has gray in his hair. He still nods when I walk in.",
        "An old establishment in town. They have, for thirty-one years, brought me a single pot of Earl Grey without my asking.",
      ],
      es: [
        "La cafetería en la esquina. Café cortado, una empanada de carne. Doña Lupe ya no me pregunta.",
        "El restaurante junto al taller. Dos huevos volteados, papas hash, café negro. Saben.",
        "Una cafetería pequeña donde pasé mis veintitantos. El barista ya tiene canas. Aún me hace una seña cuando entro.",
        "Un establecimiento antiguo del pueblo. Me han traído, durante treinta y un años, una sola tetera de Earl Grey sin que pregunte.",
      ],
    },
  },
  {
    id: 194,
    category: "love",
    depth: "depth",
    en: "Was there a friend who left this world too soon? Tell me one thing about them.",
    es: "¿Hubo un amigo que se fue de este mundo demasiado pronto? Dime una cosa de él/ella.",
    randomizeOptions: {
      en: [
        "Mi amiga Lourdes. Treinta y dos años. Tenía la risa más bonita. La sigo oyendo.",
        "Eddie. Forty-one. Could fix anything that had a motor. Couldn't fix what got him.",
        "A friend at twenty-three, in a car. He had, in the months before, taught me to listen. I have, since, tried to do as he did.",
        "A young colleague, in the spring of 1996. He had a particular laugh that the office, even years later, would unconsciously imitate.",
      ],
      es: [
        "Mi amiga Lourdes. Treinta y dos años. Tenía la risa más bonita. La sigo oyendo.",
        "Eddie. Cuarenta y uno. Arreglaba cualquier cosa con motor. No pudo arreglar lo que se lo llevó.",
        "Un amigo a los veintitrés, en un carro. Me había enseñado, en los meses anteriores, a escuchar. He intentado, desde entonces, hacer como él.",
        "Un joven colega, en la primavera de 1996. Tenía una risa particular que la oficina, incluso años después, imitaba inconscientemente.",
      ],
    },
  },
  {
    id: 195,
    category: "childhood",
    depth: "texture",
    en: "What food smells from your childhood do you wish you could bottle?",
    es: "¿Qué olores de comida de tu infancia quisieras poder embotellar?",
    randomizeOptions: {
      en: [
        "Sofrito en aceite caliente. Plátano frito. Mami picando ajo en la madera de la tabla. Si pudiera embotellarlo lo guardaría como tesoro.",
        "Pot roast and onions. Sundays. Smelled like the house had a soul.",
        "Onions sweating in butter. The smell my mother made in the first ten minutes of every dinner of my life.",
        "The unmistakable smell of a roast on a winter Sunday afternoon — a smell that stood, for me, for the entire institution of family.",
      ],
      es: [
        "Sofrito en aceite caliente. Plátano frito. Mami picando ajo en la tabla de madera. Si pudiera embotellarlo lo guardaría como tesoro.",
        "Asado y cebollas. Domingos. Olía a que la casa tenía alma.",
        "Cebollas sudando en mantequilla. El olor que mi madre hacía en los primeros diez minutos de cada cena de mi vida.",
        "El olor inconfundible de un asado en una tarde de domingo de invierno — un olor que representó, para mí, toda la institución de la familia.",
      ],
    },
  },
  {
    id: 196,
    category: "love",
    depth: "depth",
    en: "Tell me about your softest moment — when you let yourself be tender, without protecting yourself.",
    es: "Cuéntame de tu momento más suave — cuando te dejaste ser tierno, sin protegerte.",
    randomizeOptions: {
      en: [
        "Cuando mi nieta nació, la cargué, la miré, le dije 'mi vida' en voz baja. Me solté entera. Lloré sin pena.",
        "Held my dad's hand the last week. Didn't pull away. Don't think I had ever held it before.",
        "I cried in front of a stranger at a bus stop and didn't apologize. She put a hand on my shoulder. We didn't speak.",
        "I told my wife, on a Tuesday in 1997, exactly what she had meant to me. I had not, until that day, dared to say so plainly.",
      ],
      es: [
        "Cuando nació mi nieta, la cargué, la miré, le dije 'mi vida' en voz baja. Me solté entera. Lloré sin pena.",
        "Sostuve la mano de mi papá la última semana. No la solté. Creo que no la había agarrado antes.",
        "Lloré frente a una desconocida en una parada de autobús y no me disculpé. Me puso la mano en el hombro. No hablamos.",
        "Le dije a mi esposa, un martes de 1997, exactamente lo que ella había significado para mí. No había, hasta ese día, osado decirlo así de claro.",
      ],
    },
  },
  {
    id: 197,
    category: "self",
    depth: "texture",
    en: "Tell me about a haircut you regret. The story.",
    es: "Cuéntame de un corte de pelo del que te arrepientes. La historia.",
    randomizeOptions: {
      en: [
        "Un permanente a los veinte. Pelo como de payaso. Le grité a la peluquera. Después le pedí perdón.",
        "Buzz cut at fifteen. Looked like a melon. Mom laughed.",
        "Bangs, in 2007. They were not made for my face. I lived behind a hat for three months.",
        "An attempt, in 1968, at a fashion which had not, alas, been intended for any forehead resembling mine. I have, since, kept matters austere.",
      ],
      es: [
        "Un permanente a los veinte. Pelo como de payaso. Le grité a la peluquera. Después le pedí perdón.",
        "Corte al rape a los quince. Parecía melón. Mi mamá se rió.",
        "Fleco, en 2007. No estaba hecho para mi cara. Viví detrás de una gorra tres meses.",
        "Un intento, en 1968, de cierta moda que no había, ay, sido pensada para ninguna frente parecida a la mía. He mantenido, desde entonces, los asuntos austeros.",
      ],
    },
  },
  {
    id: 198,
    category: "place",
    depth: "depth",
    en: "Tell me about a place that closed that you mourned, even quietly.",
    es: "Cuéntame de un lugar que cerró y por el cual hiciste duelo, aunque fuera en silencio.",
    randomizeOptions: {
      en: [
        "La panadería en la calle ocho. Cuarenta años yendo. Cerró en pandemia. Lloré dos veces.",
        "Auto shop where I worked twenty years. Got bulldozed for a Walgreens. Don't go down that street.",
        "A used bookstore that closed in 2019. I went on the last day, bought the last copy of a book I'd been circling for a year, walked home through fog.",
        "A small chapel near my college, demolished in the early 1980s. The light through the south transept, on certain afternoons, has not been replaced.",
      ],
      es: [
        "La panadería en la calle ocho. Cuarenta años yendo. Cerró en pandemia. Lloré dos veces.",
        "El taller donde trabajé veinte años. Lo tumbaron por una farmacia. Ya no voy por esa calle.",
        "Una librería de usado que cerró en 2019. Fui el último día, compré el último ejemplar de un libro que llevaba un año rondando, caminé a casa entre la niebla.",
        "Una pequeña capilla cerca de mi universidad, demolida a principios de los ochenta. La luz por el transepto sur, ciertas tardes, no ha sido reemplazada.",
      ],
    },
  },
  {
    id: 199,
    category: "love",
    depth: "texture",
    en: "Who taught you how to dress — by example, by giving, by judgment?",
    es: "¿Quién te enseñó a vestirte — con ejemplo, con regalos, con juicio?",
    randomizeOptions: {
      en: [
        "Mi mami. Si la blusa estaba arrugada, no salías. Punto. Aún tengo esa regla.",
        "Old man. Two pairs of jeans, three shirts, one good jacket. That's the system.",
        "An older friend, the year I turned thirty, who quietly upgraded everything in my closet over a single afternoon.",
        "My mother — through example more than instruction — that one ought to dress as if the day might require something of one.",
      ],
      es: [
        "Mi mami. Si la blusa estaba arrugada, no salías. Punto. Aún tengo esa regla.",
        "Mi viejo. Dos pares de jeans, tres camisas, una chaqueta buena. Ese es el sistema.",
        "Una amiga mayor, el año que cumplí treinta, que en silencio actualizó todo mi clóset en una sola tarde.",
        "Mi madre — más por ejemplo que por instrucción — que uno debe vestirse como si el día pudiera requerir algo de uno.",
      ],
    },
  },
  {
    id: 200,
    category: "self",
    depth: "depth",
    en: "Tell me about a version of yourself you almost became, and didn't.",
    es: "Cuéntame de una versión de ti que casi llegaste a ser, y no.",
    randomizeOptions: {
      en: [
        "Casi me casé con un hombre malo. Me iba a quedar callada toda la vida. No me casé. Me salvé.",
        "Almost stayed at the plant. Almost became my old man's silence. Got out.",
        "I almost said yes to a job that would have made me richer and meaner. Said no. Don't regret it.",
        "I once stood, at thirty-nine, on the brink of a marriage that would have, in all likelihood, gradually erased me. I declined the brink.",
      ],
      es: [
        "Casi me casé con un hombre malo. Me iba a quedar callada toda la vida. No me casé. Me salvé.",
        "Casi me quedé en la planta. Casi me volví el silencio de mi viejo. Salí.",
        "Casi le dije que sí a un trabajo que me habría hecho más rica y más cruel. Dije que no. No me arrepiento.",
        "Estuve, a los treinta y nueve, al borde de un matrimonio que, con toda probabilidad, me habría borrado gradualmente. Decliné el borde.",
      ],
    },
  },
  {
    id: 201,
    category: "love",
    depth: "texture",
    en: "What do you say to a baby when you hold one?",
    es: "¿Qué le dices a un bebé cuando lo cargas?",
    randomizeOptions: {
      en: [
        "'Mi vida, mi vida.' Y le canto bajito. Y le hablo aunque no entienda.",
        "Nothing. Just bounce them.",
        "I tell them the truth. \"You are very small, and the world is very loud, and I'm sorry, and welcome.\"",
        "A nonsense phrase, half-Latin, half-improvised, that somehow always succeeds in calming the small person in question.",
      ],
      es: [
        "'Mi vida, mi vida.' Y le canto bajito. Y le hablo aunque no entienda.",
        "Nada. Sólo lo mezo.",
        "Les digo la verdad. \"Eres muy chiquito, y el mundo es muy ruidoso, y lo siento, y bienvenido.\"",
        "Una frase sin sentido, mitad latín, mitad improvisada, que siempre, de algún modo, logra calmar al pequeño en cuestión.",
      ],
    },
  },
  {
    id: 202,
    category: "love",
    depth: "texture",
    en: "What's a habit your spouse or partner has that you secretly love?",
    es: "¿Cuál es un hábito de tu pareja que en secreto adoras?",
    randomizeOptions: {
      en: [
        "Cómo Hector se aclaraba la garganta antes de hablar. Era cosa pequeña. La extraño todos los días.",
        "Wife sings when she's in a good mood. Out of key. Best sound in the world.",
        "He hums while reading. Always the same three notes. He doesn't know he does it.",
        "She still, after fifty-five years, lays out my reading glasses where I can find them. The gesture has become my home.",
      ],
      es: [
        "Cómo Hector se aclaraba la garganta antes de hablar. Era cosa pequeña. La extraño todos los días.",
        "Mi esposa canta cuando está de buen humor. Desafinada. El mejor sonido del mundo.",
        "Tararea cuando lee. Siempre las mismas tres notas. No sabe que lo hace.",
        "Ella aún, tras cincuenta y cinco años, deja mis lentes de lectura donde los pueda encontrar. El gesto se ha convertido en mi hogar.",
      ],
    },
  },
  {
    id: 203,
    category: "stories",
    depth: "depth",
    en: "Tell me about a night you didn't go home — by choice or otherwise.",
    es: "Cuéntame de una noche en que no fuiste a casa — por decisión o no.",
    randomizeOptions: {
      en: [
        "Una noche en una boda. Mami me esperaba a la una. Llegué a las cinco. Me regañó tres meses.",
        "Stayed at a buddy's after a bad fight at home. Slept on the couch. Came back the next day.",
        "Stayed up watching the sunrise on the roof of a friend's apartment in 2009. We didn't speak for the last hour. It was a complete sentence.",
        "I declined, in 1958, to return to my dormitory after a particular evening of conversation. The morning, in retrospect, was the more substantial event.",
      ],
      es: [
        "Una noche en una boda. Mami me esperaba a la una. Llegué a las cinco. Me regañó tres meses.",
        "Me quedé en casa de un cuate después de una pelea en casa. Dormí en el sofá. Volví al día siguiente.",
        "Vi el amanecer en el techo del apartamento de una amiga en 2009. No hablamos la última hora. Era una oración completa.",
        "Decliné, en 1958, regresar a mi dormitorio tras cierta velada de conversación. La mañana, en retrospectiva, fue el evento más sustancial.",
      ],
    },
  },
  {
    id: 204,
    category: "values",
    depth: "depth",
    en: "What's something you're quietly proud of that you'd never say out loud?",
    es: "¿De qué estás silenciosamente orgulloso que nunca dirías en voz alta?",
    randomizeOptions: {
      en: [
        "Que crié a mis hijos sin pegarles, a pesar de cómo me criaron a mí. Lo guardo. No alardeo.",
        "I never raised my hand to my kids. Never. Don't talk about it. I know.",
        "That I have, for nineteen years, not had a drink. I won't bring it up. I just know.",
        "That I have, in seven decades, never publicly humiliated another human being. The achievement is not large; nor is it nothing.",
      ],
      es: [
        "Que crié a mis hijos sin pegarles, a pesar de cómo me criaron a mí. Lo guardo. No alardeo.",
        "Nunca le levanté la mano a mis hijos. Nunca. No lo digo. Lo sé.",
        "Que llevo diecinueve años sin beber. No lo saco. Sólo lo sé.",
        "Que, en siete décadas, nunca he humillado públicamente a otro ser humano. El logro no es grande; tampoco es nada.",
      ],
    },
  },
  {
    id: 205,
    category: "stories",
    depth: "texture",
    en: "Tell me about a holiday meal that went sideways. What happened?",
    es: "Cuéntame de una cena de fiesta que se salió de control. ¿Qué pasó?",
    randomizeOptions: {
      en: [
        "Nochebuena del 92. Se quemó el lechón. Mi tío fue por pizza. Esa fue la mejor Nochebuena.",
        "Thanksgiving '04. Turkey caught fire. Ate cereal. Best one of all.",
        "An Easter when the lamb was, by some miracle, simultaneously raw and burnt. We ordered Chinese. Memorable.",
        "A Thanksgiving in 1984 that descended into a debate on apostolic succession. The pies, mercifully, were uncontested.",
      ],
      es: [
        "Nochebuena del 92. Se quemó el lechón. Mi tío fue por pizza. Esa fue la mejor Nochebuena.",
        "Acción de Gracias del 04. El pavo se prendió. Comimos cereal. La mejor de todas.",
        "Una Pascua en que el cordero estaba, por algún milagro, crudo y quemado a la vez. Pedimos chino. Memorable.",
        "Un Día de Acción de Gracias en 1984 que descendió en un debate sobre la sucesión apostólica. Los pasteles, misericordiosamente, no fueron disputados.",
      ],
    },
  },

  // — Batch 8 (206–235) —
  {
    id: 206,
    category: "childhood",
    depth: "texture",
    en: "What's a childhood toy you actually remember? Where is it now?",
    es: "¿Qué juguete de infancia recuerdas de verdad? ¿Dónde está ahora?",
    randomizeOptions: {
      en: [
        "Mi muñeca Lupita. Le faltaba un ojo. La perdí cuando me mudé a Miami y la lloro todavía.",
        "A wooden truck my old man made. Still got it. Beat to hell. Wouldn't sell it.",
        "A stuffed elephant whose name I still know but won't say. He's in a box in the attic, intact.",
        "A small wind-up clock that sang. Long since broken; somehow, in the music of any wind-up object, it survives.",
      ],
      es: [
        "Mi muñeca Lupita. Le faltaba un ojo. La perdí cuando me mudé a Miami y la lloro todavía.",
        "Un camioncito de madera que hizo mi viejo. Aún lo tengo. Hecho mierda. No lo vendería.",
        "Un elefante de peluche cuyo nombre aún sé pero no diré. Está en una caja en el ático, intacto.",
        "Un pequeño reloj de cuerda que cantaba. Roto hace mucho; de algún modo, en la música de cualquier objeto de cuerda, sobrevive.",
      ],
    },
  },
  {
    id: 207,
    category: "stories",
    depth: "texture",
    en: "Tell me about the first time you saw the ocean.",
    es: "Cuéntame de la primera vez que viste el mar.",
    randomizeOptions: {
      en: [
        "Tenía cinco años. Varadero. Me asusté del ruido. Mi mami me cargó. Después no me quería salir.",
        "Eight years old. Jersey shore. Couldn't believe how big. Still can't.",
        "Twenty-one, on a road trip. Pacific. I cried without knowing why and then walked into it with my shoes on.",
        "Brittany, in 1968. The grey of it, the sound, the size. Nothing in my upbringing had prepared me. Nothing has, since, surpassed it.",
      ],
      es: [
        "Tenía cinco años. Varadero. Me asusté del ruido. Mi mami me cargó. Después no me quería salir.",
        "Ocho años. La costa de Jersey. No podía creer lo grande. Aún no puedo.",
        "Veintiuno, en un viaje por carretera. El Pacífico. Lloré sin saber por qué y después me metí con los zapatos puestos.",
        "Bretaña, en 1968. El gris, el sonido, el tamaño. Nada en mi crianza me había preparado. Nada, desde entonces, lo ha superado.",
      ],
    },
  },
  {
    id: 208,
    category: "love",
    depth: "texture",
    en: "If you've been married, tell me one specific moment from the day.",
    es: "Si te has casado, cuéntame un momento específico de ese día.",
    randomizeOptions: {
      en: [
        "Hector y yo bailando 'Bésame mucho.' Sus manos me temblaban. Nunca me lo había imaginado nervioso.",
        "Saw my wife walking up. Forgot how to breathe for about two seconds.",
        "The moment after the vows when we stood and the church organ took up — I felt, briefly, that the world had clicked into a different gear.",
        "The walk back up the aisle. My wife squeezed my hand at the back pew. The squeeze, in that moment, was the entire ceremony.",
      ],
      es: [
        "Hector y yo bailando 'Bésame mucho.' Le temblaban las manos. Nunca me lo había imaginado nervioso.",
        "Vi a mi esposa caminando hacia mí. Olvidé cómo respirar como dos segundos.",
        "El momento después de los votos cuando nos pusimos de pie y el órgano de la iglesia arrancó — sentí, brevemente, que el mundo había cambiado de marcha.",
        "El paseo de regreso por el pasillo. Mi esposa me apretó la mano en la última banca. El apretón, en ese momento, fue toda la ceremonia.",
      ],
    },
  },
  {
    id: 209,
    category: "stories",
    depth: "texture",
    en: "Tell me about something you stole as a kid. Did anyone find out?",
    es: "Cuéntame de algo que robaste de niño. ¿Alguien se enteró?",
    randomizeOptions: {
      en: [
        "Un caramelo de la tienda. Mi mami se dio cuenta y me hizo regresar. Lloré. Nunca volví a robar nada.",
        "Pack of gum from the corner store. Got home. Couldn't enjoy it. Brought it back the next day.",
        "A book from the school library. I kept it three years before I could bear to return it. The librarian, I think, knew.",
        "An apple from a neighbor's orchard, age nine. Mr. Hollings caught me. He, mercifully, gave me a second one for the walk home.",
      ],
      es: [
        "Un caramelo de la tienda. Mi mami se dio cuenta y me hizo devolverlo. Lloré. Nunca volví a robar nada.",
        "Un paquete de chicles de la tienda de la esquina. Llegué a casa. No los disfruté. Los regresé al día siguiente.",
        "Un libro de la biblioteca de la escuela. Lo tuve tres años antes de poder devolverlo. La bibliotecaria, creo, lo sabía.",
        "Una manzana del huerto de un vecino, a los nueve. El señor Hollings me atrapó. Él, misericordiosamente, me dio otra para el camino.",
      ],
    },
  },
  {
    id: 210,
    category: "stories",
    depth: "depth",
    en: "Was there a time you got out of a bad situation by your own wits?",
    es: "¿Hubo una vez que saliste de una mala situación por tu propia astucia?",
    randomizeOptions: {
      en: [
        "Un hombre me siguió en la calle a los veinte. Entré a una iglesia. El cura me llevó a casa. Eso me enseñó a no callar el miedo.",
        "Bar fight in '94. Talked my way out. Did not have to fight. That's a skill.",
        "Cornered at a party at twenty-two. Pretended I'd seen a friend across the room and walked out steady. Didn't run. Didn't apologize.",
        "An interview, in 1969, in which I had been quietly cornered by a hostile member of a board. I declined, with civility, to give him the satisfaction.",
      ],
      es: [
        "Un hombre me siguió en la calle a los veinte. Entré a una iglesia. El cura me llevó a casa. Eso me enseñó a no callar el miedo.",
        "Pelea de bar en el 94. Me las arreglé hablando. No tuve que pelear. Eso es habilidad.",
        "Acorralada en una fiesta a los veintidós. Fingí ver a una amiga del otro lado y salí firme. No corrí. No me disculpé.",
        "Una entrevista, en 1969, en la que un miembro hostil de un consejo me había acorralado discretamente. Decliné, con civilidad, darle la satisfacción.",
      ],
    },
  },
  {
    id: 211,
    category: "love",
    depth: "texture",
    en: "How does your handwriting on a card look? What do you usually write?",
    es: "¿Cómo es tu letra en una tarjeta? ¿Qué sueles escribir?",
    randomizeOptions: {
      en: [
        "Cursiva grande, redonda. Termino con 'te quiero, mi amor' y dos corazones.",
        "All caps. \"Happy birthday. Love, Dad.\" That's it.",
        "Lowercase, slightly slanted, an em-dash before the signature. Usually a quote, sometimes a sentence I'd never say out loud.",
        "A copperplate-ish cursive, with a benediction in Latin if I am feeling sentimental, which I, on occasion, am.",
      ],
      es: [
        "Cursiva grande, redonda. Termino con 'te quiero, mi amor' y dos corazones.",
        "Todo en mayúsculas. \"Feliz cumpleaños. Con cariño, papá.\" Y ya.",
        "Minúsculas, ligeramente inclinadas, un guión largo antes de la firma. Generalmente una cita, a veces una oración que no diría en voz alta.",
        "Una cursiva inglesa, con una bendición en latín si me siento sentimental, lo cual, en ocasiones, sucede.",
      ],
    },
  },
  {
    id: 212,
    category: "values",
    depth: "depth",
    en: "What do you imagine happens to your stuff after you're gone?",
    es: "¿Qué imaginas que pasa con tus cosas cuando ya no estés?",
    randomizeOptions: {
      en: [
        "Mi rosario para mi nieta. Las recetas de mami para mi hija. Mis fotos para todos. Lo demás, que se vaya.",
        "Tools for the kids. House sells. Don't care after that.",
        "I hope my books find people. The rest can be donated. The objects mattered to me; the people they go to should choose what matters to them.",
        "I have, in fact, given a great deal of it away already. The remainder may be apportioned according to my will, or to whatever instinct seems wisest at the time.",
      ],
      es: [
        "Mi rosario para mi nieta. Las recetas de mami para mi hija. Mis fotos para todos. Lo demás, que se vaya.",
        "Las herramientas para mis hijos. La casa se vende. Después, no importa.",
        "Espero que mis libros encuentren personas. Lo demás se puede donar. Los objetos me importaron; las personas a quienes lleguen elegirán qué les importa a ellas.",
        "He regalado, en efecto, gran parte ya. Lo restante podrá repartirse según mi testamento, o según el instinto que parezca más sabio en el momento.",
      ],
    },
  },
  {
    id: 213,
    category: "love",
    depth: "depth",
    en: "What was the last meal you shared with someone you've since lost?",
    es: "¿Cuál fue la última comida que compartiste con alguien que ya no está?",
    randomizeOptions: {
      en: [
        "Con mami. Sopa de pollo, en su casa. Yo le dije: 'mami, qué rico.' Esa noche se acostó y al día siguiente se fue.",
        "Diner with my old man. He had pancakes. I had eggs. We didn't say much. Wish we had.",
        "A long lunch with my best friend, two months before. We argued about whether the bread was good. The bread was good.",
        "A simple supper with my late wife — soup, bread, the news on low. We have, in our long life, not improved upon it.",
      ],
      es: [
        "Con mami. Sopa de pollo, en su casa. Yo le dije: 'mami, qué rico.' Esa noche se acostó y al día siguiente se fue.",
        "Restaurante con mi viejo. Él pidió hot cakes. Yo huevos. No dijimos mucho. Ojalá hubiéramos.",
        "Un almuerzo largo con mi mejor amiga, dos meses antes. Discutimos si el pan estaba bueno. El pan estaba bueno.",
        "Una cena sencilla con mi difunta esposa — sopa, pan, las noticias en volumen bajo. No hemos, en nuestra larga vida, mejorado eso.",
      ],
    },
  },
  {
    id: 214,
    category: "stories",
    depth: "texture",
    en: "Tell me about a lie you told your mother that you've never confessed.",
    es: "Cuéntame de una mentira que le dijiste a tu madre y nunca confesaste.",
    randomizeOptions: {
      en: [
        "Le dije que dormí en casa de Lourdes a los dieciséis. Era mentira. Estaba con un muchacho. Mi mami nunca supo y se llevó el secreto.",
        "Told her I quit smoking ten years before I actually did. She bought it.",
        "Told her, at twenty-three, that the relationship was good. It wasn't. It was already over. I just couldn't say it yet.",
        "I told my mother, in 1962, that the grade had been a B. It had not been. The lie has, in retrospect, weighed more than the grade ever could have.",
      ],
      es: [
        "Le dije que dormí en casa de Lourdes a los dieciséis. Era mentira. Estaba con un muchacho. Mi mami nunca supo y se llevó el secreto.",
        "Le dije que había dejado de fumar diez años antes de que realmente lo hiciera. Me la creyó.",
        "Le dije, a los veintitrés, que la relación iba bien. No iba. Ya se había acabado. Sólo aún no podía decirlo.",
        "Le dije a mi madre, en 1962, que la calificación había sido una B. No había sido. La mentira ha pesado, en retrospectiva, más de lo que la calificación jamás pudo.",
      ],
    },
  },
  {
    id: 215,
    category: "self",
    depth: "texture",
    en: "What's a smell — gas, laundry, polish — that means a specific person to you?",
    es: "¿Qué olor — gasolina, detergente, lustre — te recuerda a una persona específica?",
    randomizeOptions: {
      en: [
        "El olor de Suavitel. Mi mami. Cada vez que lo huelo, se me llenan los ojos.",
        "Diesel and aftershave. Old man. End of conversation.",
        "Sandalwood and something soapy. A friend I had in my twenties. I haven't seen her in fourteen years and the smell still finds me.",
        "Pipe tobacco and a particular bay rum. My grandfather. The smell is, on certain afternoons, the room itself.",
      ],
      es: [
        "El olor de Suavitel. Mi mami. Cada vez que lo huelo, se me llenan los ojos.",
        "Diesel y aftershave. Mi viejo. Fin de la conversación.",
        "Sándalo y algo a jabón. Una amiga de mis veintes. No la he visto en catorce años y el olor todavía me encuentra.",
        "Tabaco de pipa y cierta agua de colonia. Mi abuelo. El olor es, en ciertas tardes, el cuarto mismo.",
      ],
    },
  },
  {
    id: 216,
    category: "self",
    depth: "depth",
    en: "What do you do when you get angry now? What did you used to do?",
    es: "¿Qué haces cuando te enojas ahora? ¿Qué hacías antes?",
    randomizeOptions: {
      en: [
        "Antes gritaba. Ahora me callo, lavo platos, rezo. La cocina queda limpia y el corazón también.",
        "Used to slam doors. Now I go for a walk. Walk's better. Less to fix later.",
        "I used to argue. Now I leave the room and write a sentence I won't send. The sentence usually does the work.",
        "I once expressed it; I now contemplate it. Anger has, over the years, become a thing one observes rather than wears.",
      ],
      es: [
        "Antes gritaba. Ahora me callo, lavo platos, rezo. La cocina queda limpia y el corazón también.",
        "Antes azotaba puertas. Ahora salgo a caminar. La caminata es mejor. Menos que arreglar después.",
        "Antes discutía. Ahora salgo del cuarto y escribo una oración que no envío. La oración suele hacer el trabajo.",
        "Antes lo expresaba; ahora lo contemplo. El enojo se ha vuelto, con los años, algo que uno observa en vez de portar.",
      ],
    },
  },
  {
    id: 217,
    category: "stories",
    depth: "depth",
    en: "Tell me about a time you spent in a hospital. What stayed with you?",
    es: "Cuéntame de una vez que pasaste en un hospital. ¿Qué se te quedó?",
    randomizeOptions: {
      en: [
        "Cuando di a luz a mi hija. Lo que se me quedó: la luz amarilla del techo y el olor de Hector cuando me besó.",
        "Hernia surgery. Two days. Nurse named Carla was the only person who didn't talk to me like I was made of glass.",
        "A friend's bedside. The slow, clean, terrible blue of the room at three a.m. The hum of machinery. Her hand in mine.",
        "A long stay in 1996, in which I learned that the dignity of a hospital depends, in large part, on the kindness of the night staff.",
      ],
      es: [
        "Cuando di a luz a mi hija. Lo que se me quedó: la luz amarilla del techo y el olor de Hector cuando me besó.",
        "Cirugía de hernia. Dos días. La enfermera Carla fue la única que no me hablaba como si fuera de vidrio.",
        "La cabecera de una amiga. El azul lento, limpio, terrible del cuarto a las tres de la mañana. El zumbido de las máquinas. Su mano en la mía.",
        "Una estancia larga en 1996, en la cual aprendí que la dignidad de un hospital depende, en gran medida, de la bondad del personal de la noche.",
      ],
    },
  },
  {
    id: 218,
    category: "family",
    depth: "texture",
    en: "Tell me about a holiday tradition — even a small one — that you'd refuse to let go of.",
    es: "Cuéntame de una tradición de fiestas — aunque sea chica — que te rehúsas a soltar.",
    randomizeOptions: {
      en: [
        "Hacer pastelitos de guayaba con mami. Yo los hago ahora. Si no lo hago, no es Nochebuena.",
        "Fishing on Christmas morning. Twenty-six years now. Sleet, snow, doesn't matter. I go.",
        "We watch one specific old movie on Christmas Eve. Always the same one. We narrate the lines. Don't ask me to skip it.",
        "A particular candle, on the dining table, lit each Christmas Eve at six o'clock. The candle has, on at least three occasions, outlived a guest list.",
      ],
      es: [
        "Hacer pastelitos de guayaba con mami. Yo los hago ahora. Si no lo hago, no es Nochebuena.",
        "Pescar la mañana de Navidad. Veintiséis años ya. Aguanieve, nieve, no importa. Voy.",
        "Vemos una vieja película específica en Nochebuena. Siempre la misma. Narramos los diálogos. No me pidas que la salte.",
        "Una vela particular, en la mesa del comedor, encendida cada Nochebuena a las seis en punto. La vela ha, en al menos tres ocasiones, sobrevivido a una lista de invitados.",
      ],
    },
  },
  {
    id: 219,
    category: "self",
    depth: "texture",
    en: "What was the first cologne or perfume you wore on purpose?",
    es: "¿Cuál fue el primer perfume o colonia que usaste a propósito?",
    randomizeOptions: {
      en: [
        "Anaís Anaís. A los diecisiete. Lo escogió mi prima. Me hacía sentir mujer.",
        "Drakkar Noir. '93. I thought I was something. I was not.",
        "An Issey Miyake my friend gave me at twenty-six. The bottle's been empty fifteen years. I haven't replaced it on purpose.",
        "An English bay rum given to me upon my twenty-first birthday. I have, in matters of scent as in others, declined to reinvent the wheel.",
      ],
      es: [
        "Anaís Anaís. A los diecisiete. Lo escogió mi prima. Me hacía sentir mujer.",
        "Drakkar Noir. 93. Pensaba que era alguien. No lo era.",
        "Un Issey Miyake que me regaló mi amigo a los veintiséis. El frasco está vacío hace quince años. No lo he reemplazado a propósito.",
        "Un agua de colonia inglesa que me regalaron en mi cumpleaños número veintiuno. He, en cuestiones de aroma como en otras, declinado reinventar la rueda.",
      ],
    },
  },
  {
    id: 220,
    category: "stories",
    depth: "texture",
    en: "Tell me about a neighbor who became part of your story.",
    es: "Cuéntame de un vecino que se volvió parte de tu historia.",
    randomizeOptions: {
      en: [
        "Doña Hilda, en Hialeah. Cuarenta años al lado de mi casa. Me trajo sopa cuando murió Hector. Me trae sopa todavía cada vez que me ve triste.",
        "Old man across the street. Fixed my truck twice. Wouldn't take money. Brought him a six-pack every Christmas till he died.",
        "A woman two doors down who became, gradually, the friend I needed. We have, between us, traded six casserole dishes and, at this point, all our secrets.",
        "A retired naval officer next door, whose stoicism I observed, in 1991, with the attention I formerly reserved for poetry.",
      ],
      es: [
        "Doña Hilda, en Hialeah. Cuarenta años al lado de mi casa. Me trajo sopa cuando murió Hector. Me trae sopa todavía cada vez que me ve triste.",
        "Un viejo del otro lado de la calle. Me arregló la camioneta dos veces. No quiso cobrar. Le llevé un seis de cervezas cada Navidad hasta que murió.",
        "Una mujer dos puertas más abajo que se volvió, gradualmente, la amiga que necesitaba. Hemos, entre las dos, intercambiado seis cazuelas y, a estas alturas, todos nuestros secretos.",
        "Un oficial naval retirado en la casa de al lado, cuyo estoicismo observé, en 1991, con la atención que antes reservaba para la poesía.",
      ],
    },
  },
  {
    id: 221,
    category: "advice",
    depth: "depth",
    en: "What's a thing you teach without trying? Like, your kids picked it up from watching you.",
    es: "¿Qué cosa enseñas sin proponértelo? Algo que tus hijos aprendieron de verte.",
    randomizeOptions: {
      en: [
        "A esperar la mesa hasta que estuvieran todos. Pequeño detalle. Mi nieta lo hace ahora con su gato.",
        "Don't talk over people. Don't have to. Wait. They notice.",
        "I never ate the last bite. My kids picked it up. None of us, now, will eat the last bite. The plates are always slightly insulting.",
        "An extreme attentiveness to the comfort of guests. My children, on this point, have surpassed me without my having taught a single rule.",
      ],
      es: [
        "A esperar a que estén todos en la mesa. Detallito. Mi nieta lo hace ahora con su gato.",
        "No interrumpir. No hace falta. Esperas. Lo notan.",
        "Nunca me comí el último bocado. Mis hijos lo agarraron. Ninguno de nosotros, ahora, se come el último bocado. Los platos quedan siempre ligeramente insultantes.",
        "Una atención extrema al confort de los invitados. Mis hijos, en este punto, me han superado sin que yo haya enseñado una sola regla.",
      ],
    },
  },
  {
    id: 222,
    category: "stories",
    depth: "texture",
    en: "Tell me about a kitchen disaster you survived (and remember laughing about later).",
    es: "Cuéntame de un desastre de cocina que sobreviviste (y del que después te reíste).",
    randomizeOptions: {
      en: [
        "Se me quemó el arroz dos años seguidos en Acción de Gracias en casa de mi suegra. Al tercer año pedí pizza y nadie dijo nada.",
        "Set the kitchen towel on fire. Twice. Different towels. Different years.",
        "I confidently boiled potatoes with no water. The pot is, to this day, in my mother's house, as a memorial.",
        "I attempted, in 1971, a soufflé in the absence of either skill or eggs of sufficient freshness. The result has, mercifully, been redacted from the family record.",
      ],
      es: [
        "Se me quemó el arroz dos años seguidos en Acción de Gracias en casa de mi suegra. Al tercer año pedí pizza y nadie dijo nada.",
        "Le prendí fuego al trapo de la cocina. Dos veces. Trapos distintos. Años distintos.",
        "Hervi papas, con confianza, sin agua. La olla está, hasta hoy, en casa de mi madre, como monumento.",
        "Intenté, en 1971, un soufflé en ausencia tanto de habilidad como de huevos suficientemente frescos. El resultado ha sido, misericordiosamente, redactado del registro familiar.",
      ],
    },
  },
  {
    id: 223,
    category: "self",
    depth: "depth",
    en: "Tell me about a quietly good day you had recently. The shape of it.",
    es: "Cuéntame de un día tranquilamente bueno que tuviste hace poco. La forma de él.",
    randomizeOptions: {
      en: [
        "Lunes. Café temprano. Llamé a mi nieta. Sembré una matita. La cena la hice yo. Nada espectacular. Todo bueno.",
        "Saturday. Worked on the truck. Drank coffee. Read for an hour. Slept good.",
        "Tuesday last week. Long walk. Didn't check my phone. Made a sandwich at three. Sat in the sun. Easy.",
        "An unhurried Wednesday in early autumn. The mail was uneventful, the soup was correct, and the day, in not asking much of me, gave me everything.",
      ],
      es: [
        "Lunes. Café temprano. Llamé a mi nieta. Sembré una matita. La cena la hice yo. Nada espectacular. Todo bueno.",
        "Sábado. Trabajé en la camioneta. Tomé café. Leí una hora. Dormí bien.",
        "Martes de la semana pasada. Caminata larga. No revisé el teléfono. Me hice un sándwich a las tres. Me senté al sol. Fácil.",
        "Un miércoles sin prisa, a principios de otoño. La correspondencia fue insignificante, la sopa fue correcta, y el día, al no pedir mucho de mí, me lo dio todo.",
      ],
    },
  },
  {
    id: 224,
    category: "family",
    depth: "texture",
    en: "Is there a piece of jewelry that has a story for you?",
    es: "¿Hay una joya que tenga una historia para ti?",
    randomizeOptions: {
      en: [
        "Una pulserita que mi mami me dio a los quince. Pierdo todo. Esto no se ha perdido. Cuarenta y siete años después.",
        "Watch I bought myself when I made foreman. Nothing fancy. Wear it every day.",
        "A ring that belonged to a great-aunt I never met. The story came with it; I've added my own. I won't pass it on without telling both.",
        "A signet ring with my grandfather's initials. He wore it from 1924 until he died. I have, since, worn it as a small daily promise.",
      ],
      es: [
        "Una pulserita que me dio mi mami a los quince. Pierdo todo. Esto no se ha perdido. Cuarenta y siete años después.",
        "Un reloj que me compré cuando me hice capataz. Nada elegante. Lo uso a diario.",
        "Un anillo que pertenecía a una tía abuela que nunca conocí. La historia vino con él; le he agregado la mía. No lo pasaré sin contar las dos.",
        "Un anillo de sello con las iniciales de mi abuelo. Lo usó desde 1924 hasta que murió. Lo he portado, desde entonces, como una pequeña promesa diaria.",
      ],
    },
  },
  {
    id: 225,
    category: "stories",
    depth: "texture",
    en: "Have you been lost in a foreign place? Tell me how it felt.",
    es: "¿Has estado perdido en un lugar extranjero? Cuéntame cómo se sintió.",
    randomizeOptions: {
      en: [
        "Roma. Sin español. Sin italiano. Sin mapa. Una señora me dio agua y me señaló el camino con las manos. Lloré sin saber por qué.",
        "Paris '92. Couldn't find my hotel. Walked four hours. Slept on a bench an hour. Worth it.",
        "Tokyo at twenty-eight. Lost for an hour, found a noodle shop, ate the best meal of my life. The lostness was the meal.",
        "Madrid, 1972. Without language and with very little money. The lostness, after a respectable amount of panic, became its own kind of competence.",
      ],
      es: [
        "Roma. Sin español. Sin italiano. Sin mapa. Una señora me dio agua y me indicó el camino con las manos. Lloré sin saber por qué.",
        "París 92. No encontraba el hotel. Caminé cuatro horas. Dormí una hora en una banca. Valió la pena.",
        "Tokio a los veintiocho. Perdida una hora, encontré un noodle shop, comí la mejor comida de mi vida. Lo perdido fue la comida.",
        "Madrid, 1972. Sin idioma y con muy poco dinero. Lo perdido, tras una cantidad respetable de pánico, se volvió su propia especie de competencia.",
      ],
    },
  },
  {
    id: 226,
    category: "love",
    depth: "texture",
    en: "Was there a coworker who became more like family than just a coworker?",
    es: "¿Hubo un compañero de trabajo que se volvió más familia que compañero?",
    randomizeOptions: {
      en: [
        "Carmen, en mi primer trabajo. Almorzábamos todos los días en su escritorio. Hoy es mi comadre.",
        "Tony at the shop. Twenty years side by side. Best man at his second wedding.",
        "A junior coworker who, gradually, became one of my favorite people on earth. We have outlasted three companies and counting.",
        "A research partner whose office adjoined mine for nineteen years. We are now, by every measure that matters, kin.",
      ],
      es: [
        "Carmen, en mi primer trabajo. Almorzábamos en su escritorio todos los días. Hoy es mi comadre.",
        "Tony del taller. Veinte años lado a lado. Padrino en su segunda boda.",
        "Una compañera junior que, gradualmente, se volvió una de mis personas favoritas en la tierra. Hemos sobrevivido tres compañías y contando.",
        "Un compañero de investigación cuya oficina colindaba con la mía durante diecinueve años. Somos ahora, por cualquier medida que importe, parientes.",
      ],
    },
  },
  {
    id: 227,
    category: "love",
    depth: "depth",
    en: "Is there a voicemail you saved that you can't bring yourself to delete?",
    es: "¿Hay un mensaje de voz guardado que no eres capaz de borrar?",
    randomizeOptions: {
      en: [
        "El último de mami. 'Mi vida, llámame cuando puedas.' La llamé media hora después. Pero el mensaje sigue ahí. Lo escucho cada año en su cumpleaños.",
        "My old man's voicemail. \"Call me back when you can.\" One sentence. Don't delete it. Won't.",
        "A friend left me a one-minute voicemail laughing at her own joke. She has been gone four years. I keep it on the cloud, on my phone, and on a backup hard drive.",
        "A message from my late wife, in 2018, asking when I'd be home for dinner. The kitchen, after all, is still here.",
      ],
      es: [
        "El último de mami. 'Mi vida, llámame cuando puedas.' La llamé media hora después. Pero el mensaje sigue ahí. Lo escucho cada año en su cumpleaños.",
        "El mensaje de voz de mi viejo. \"Llámame cuando puedas.\" Una frase. No lo borro. No lo voy a borrar.",
        "Una amiga me dejó un mensaje de un minuto riéndose de su propio chiste. Lleva cuatro años fuera. Lo guardo en la nube, en el teléfono, y en un disco de respaldo.",
        "Un mensaje de mi difunta esposa, de 2018, preguntándome a qué hora llegaba a cenar. La cocina, después de todo, sigue aquí.",
      ],
    },
  },
  {
    id: 228,
    category: "self",
    depth: "depth",
    en: "What's something you've never told a therapist (because you were saving it, or skipping it)?",
    es: "¿Qué cosa nunca le has dicho a un terapeuta (porque la guardabas, o la evitabas)?",
    randomizeOptions: {
      en: [
        "Que a veces siento envidia de mi hermana porque su matrimonio duró. Es feo decirlo. Pero ahí está.",
        "I've never said out loud that I sometimes wish I'd had different parents. Saying it now, I guess.",
        "I've been afraid, for a decade, that I'm not the kind of person I claim to be. I haven't named it because naming it would be a project.",
        "An episode in 1968 that I have, with some success, declined to discuss with anyone professionally trained to inquire.",
      ],
      es: [
        "Que a veces siento envidia de mi hermana porque su matrimonio duró. Es feo decirlo. Pero ahí está.",
        "Nunca he dicho en voz alta que a veces hubiera querido tener otros padres. Bueno, lo digo ahora.",
        "Llevo una década con miedo de no ser el tipo de persona que digo ser. No lo he nombrado porque nombrarlo sería un proyecto.",
        "Un episodio de 1968 que he, con cierto éxito, declinado discutir con cualquiera profesionalmente entrenado para preguntar.",
      ],
    },
  },
  {
    id: 229,
    category: "love",
    depth: "texture",
    en: "What does your mother's voice sound like on the phone?",
    es: "¿Cómo suena la voz de tu madre en el teléfono?",
    randomizeOptions: {
      en: [
        "Bajita. Cantarina. Empieza cada llamada con 'Mi vida, ¿cómo está?' Ya la tengo grabada en la cabeza.",
        "Crackly. She doesn't trust speakerphone. Makes me yell.",
        "Slightly performative when answering, then unguarded once she knows it's me. The shift is the whole conversation.",
        "Cool, articulate, with a faint Mid-Atlantic vestige she did not choose. The voice, after all these years, remains a comfort.",
      ],
      es: [
        "Bajita. Cantarina. Empieza cada llamada con 'Mi vida, ¿cómo está?' Ya la tengo grabada en la cabeza.",
        "Cortada. No confía en el altavoz. Me hace gritar.",
        "Ligeramente actuada al contestar, luego sin guardia cuando sabe que soy yo. El cambio es la conversación entera.",
        "Fresca, articulada, con un leve vestigio mid-atlántico que no escogió. La voz, tras todos estos años, sigue siendo un consuelo.",
      ],
    },
  },
  {
    id: 230,
    category: "family",
    depth: "depth",
    en: "Did a grandparent or great-grandparent emigrate? What do you know about why?",
    es: "¿Algún abuelo o bisabuelo emigró? ¿Qué sabes de por qué?",
    randomizeOptions: {
      en: [
        "Mi abuelo de Galicia. Llegó a Cuba a los dieciocho con un saco. Nunca regresó. Nunca habló de su madre sin llorar.",
        "Grandparents came over from Sicily in '21. Worked the docks. Don't know much else. Wish I'd asked.",
        "My great-grandmother left Ireland in 1899. The family has, between us, exactly three sentences and one tintype that explain why.",
        "My maternal grandfather, in 1908, departed a particular small town in Bohemia under conditions that, at this remove, are matters of family lore rather than fact.",
      ],
      es: [
        "Mi abuelo de Galicia. Llegó a Cuba a los dieciocho con un saco. Nunca regresó. Nunca habló de su madre sin llorar.",
        "Mis abuelos vinieron de Sicilia en el 21. Trabajaron en los muelles. No sé mucho más. Ojalá hubiera preguntado.",
        "Mi bisabuela salió de Irlanda en 1899. La familia tiene, entre todos, exactamente tres oraciones y una tintura que explican por qué.",
        "Mi abuelo materno, en 1908, partió de cierto pueblo pequeño de Bohemia bajo condiciones que, a esta distancia, son materia de lore familiar más que de hecho.",
      ],
    },
  },
  {
    id: 231,
    category: "self",
    depth: "surface",
    en: "What do you keep in your wallet — beyond the obvious?",
    es: "¿Qué tienes en tu cartera — más allá de lo obvio?",
    randomizeOptions: {
      en: [
        "Una estampita de la Caridad del Cobre. Y un papelito con la letra de mi nieta que dice 'te quiero.'",
        "Pocketknife. Lottery ticket. Folded picture of the kids when they were small.",
        "A receipt I have not been able to throw away. A pressed flower. A note from a stranger.",
        "A library card from a library no longer in existence. Sentiment, in the ordinary sense, has its accommodations.",
      ],
      es: [
        "Una estampita de la Caridad del Cobre. Y un papelito con la letra de mi nieta que dice 'te quiero.'",
        "Una navaja. Un boleto de lotería. Una foto doblada de los hijos cuando eran chicos.",
        "Un recibo que no he podido tirar. Una flor prensada. Una nota de una desconocida.",
        "Una tarjeta de biblioteca de una biblioteca que ya no existe. El sentimentalismo, en el sentido común, tiene sus acomodos.",
      ],
    },
  },
  {
    id: 232,
    category: "self",
    depth: "depth",
    en: "What's a skill you didn't think mattered, that turned out to matter?",
    es: "¿Qué habilidad creías que no importaba, y que resultó importar?",
    randomizeOptions: {
      en: [
        "Saber escuchar sin contestar. Lo aprendí cuidando enfermos. Es lo más útil que tengo.",
        "Knowing when not to talk. Took me forty years. Was the move all along.",
        "Writing a clean email under pressure. A small thing. Has saved me, in fact, repeatedly.",
        "An ability to acknowledge an error promptly and without theatre. The skill is, in middle age, almost a superpower.",
      ],
      es: [
        "Saber escuchar sin contestar. Lo aprendí cuidando enfermos. Es lo más útil que tengo.",
        "Saber cuándo callar. Me tomó cuarenta años. Era la movida desde siempre.",
        "Escribir un correo limpio bajo presión. Pequeñez. Me ha salvado, en efecto, repetidamente.",
        "Una capacidad para reconocer un error pronto y sin teatro. La destreza es, en la mediana edad, casi un superpoder.",
      ],
    },
  },
  {
    id: 233,
    category: "love",
    depth: "depth",
    en: "When did someone first introduce you as theirs — wife, husband, friend, person?",
    es: "¿Cuándo alguien te presentó por primera vez como suyo — esposa, esposo, amigo, su persona?",
    randomizeOptions: {
      en: [
        "Hector me presentó en su trabajo: 'Esta es Marisol, mi esposa.' Yo todavía era novia. Pero ya éramos.",
        "Buddy introduced me as his brother once. Wasn't blood. Was true.",
        "A friend, at a party, said \"this is my person\" — not partner, not anything fancier. The phrase has, in the years since, been the highest compliment I've received.",
        "My wife, at a faculty mixer in 1972, said simply, \"This is Hal.\" The simplicity, on that night, told me she was sure.",
      ],
      es: [
        "Hector me presentó en su trabajo: 'Esta es Marisol, mi esposa.' Yo todavía era novia. Pero ya éramos.",
        "Un cuate me presentó como su hermano una vez. No éramos de sangre. Éramos verdad.",
        "Una amiga, en una fiesta, dijo \"esta es mi persona\" — no pareja, no nada más fancy. La frase ha sido, en los años siguientes, el cumplido más alto que he recibido.",
        "Mi esposa, en un convivio del profesorado en 1972, dijo simplemente: \"Este es Hal.\" La sencillez, esa noche, me dijo que estaba segura.",
      ],
    },
  },
  {
    id: 234,
    category: "love",
    depth: "texture",
    en: "Is there a wedding ring or symbol you wear (or wore) that holds a specific meaning?",
    es: "¿Hay un anillo de bodas o símbolo que llevas (o llevabas) que tiene un significado específico?",
    randomizeOptions: {
      en: [
        "El anillo de Hector. No me lo quito. Me sigue dando suerte.",
        "Plain gold band. Forty-one years on. Not coming off.",
        "A small pendant my partner gave me before we married. I don't wear it daily. I know exactly which drawer.",
        "A simple gold band engraved with the date of our wedding in 1968. The engraving has, by now, almost worn away. The vow has not.",
      ],
      es: [
        "El anillo de Hector. No me lo quito. Me sigue dando suerte.",
        "Argolla simple de oro. Cuarenta y un años puesto. No se va.",
        "Un dije pequeño que me regaló mi pareja antes de casarnos. No lo uso a diario. Sé exactamente en qué cajón.",
        "Una sencilla argolla de oro grabada con la fecha de nuestra boda en 1968. El grabado, a estas alturas, casi se ha borrado. El voto, no.",
      ],
    },
  },
  {
    id: 235,
    category: "legacy",
    depth: "soul",
    en: "What would you actually want at your funeral? Music, words, who's there?",
    es: "¿Qué querrías de verdad en tu funeral? Música, palabras, quién esté.",
    randomizeOptions: {
      en: [
        "Mi familia. La canción 'Bésame mucho.' Mucha comida. Que cuenten chistes. No quiero gente seria llorando todo el día.",
        "Small. Family. A handful of friends. Don't make speeches. Eat well after. Tell one good story.",
        "Music — Joni Mitchell, no eulogies, my closest people, and ten minutes of silence at the end. I've written it down twice.",
        "A short service. A reading from Auden. The presence of those who will, on any given day, remember without prompting. Then dinner.",
      ],
      es: [
        "Mi familia. La canción 'Bésame mucho.' Mucha comida. Que cuenten chistes. No quiero gente seria llorando todo el día.",
        "Pequeño. Familia. Unos cuantos amigos. Sin discursos. Coman bien después. Cuenten una buena historia.",
        "Música — Joni Mitchell, sin elogios, mis personas más cercanas, y diez minutos de silencio al final. Lo he escrito dos veces.",
        "Un servicio breve. Una lectura de Auden. La presencia de quienes, en cualquier día, recordarán sin que se les pida. Después, cena.",
      ],
    },
  },

  // — Batch 9 (236–265) —
  {
    id: 236,
    category: "stories",
    depth: "texture",
    en: "Tell me about the first time you saw snow — or the first time it actually felt magical.",
    es: "Cuéntame de la primera vez que viste nieve — o la primera vez que de verdad te pareció mágica.",
    randomizeOptions: {
      en: [
        "Tenía treinta. Mi primer invierno en Nueva York. Lloré como tonta. Mami no la había visto nunca.",
        "Five years old, Buffalo. Stood there until my dad pulled me in by the hood.",
        "I was eleven, in Vermont, a Sunday morning, and the silence of the snow was the first silence I had ever, in my noisy life, fully heard.",
        "Christmas Eve, 1939. The dim lamps, the white road, my mother's hand. The image has, in eighty-six years, never paled.",
      ],
      es: [
        "Tenía treinta. Mi primer invierno en Nueva York. Lloré como tonta. Mami no la había visto nunca.",
        "Cinco años, Buffalo. Me quedé parada hasta que mi papá me jaló del gorro.",
        "Tenía once años, en Vermont, un domingo en la mañana, y el silencio de la nieve fue el primer silencio que escuché por completo en mi vida ruidosa.",
        "Nochebuena, 1939. Las lámparas tenues, el camino blanco, la mano de mi madre. La imagen no ha palidecido, en ochenta y seis años.",
      ],
    },
  },
  {
    id: 237,
    category: "self",
    depth: "texture",
    en: "What's an object you keep meaning to fix and never do?",
    es: "¿Qué objeto sigues queriendo arreglar y nunca arreglas?",
    randomizeOptions: {
      en: [
        "El reloj de pared de mi mami. No anda hace ocho años. No lo voy a arreglar pero ahí sigue.",
        "Lawn mower. Started it once in '21. Not since. It's still in the shed.",
        "A clock that my grandfather repaired twice. I have, for three years, intended to take it to the same shop he used. The intention is, by now, the project.",
        "An antique fountain pen, the nib of which has resisted four restorations. I shall, no doubt, try a fifth.",
      ],
      es: [
        "El reloj de pared de mi mami. No anda hace ocho años. No lo voy a arreglar pero ahí sigue.",
        "La cortadora de zacate. La prendí una vez en el 21. Desde entonces no. Sigue en el cobertizo.",
        "Un reloj que mi abuelo reparó dos veces. Llevo tres años pensando llevarlo al mismo taller que él usaba. La intención es, a estas alturas, el proyecto.",
        "Una pluma fuente antigua, cuya punta ha resistido cuatro restauraciones. Intentaré, sin duda, una quinta.",
      ],
    },
  },
  {
    id: 238,
    category: "stories",
    depth: "depth",
    en: "Was there a morning you woke up and knew you were a different person now?",
    es: "¿Hubo una mañana en que despertaste y supiste que ya eras otra persona?",
    randomizeOptions: {
      en: [
        "La mañana después de que murió mami. Me senté en la cocina y supe: ya no soy hija. Ahora soy raíz.",
        "Morning after my divorce was final. Made coffee. Knew I was someone else now. Drank it.",
        "The morning after my daughter was born. I had not so much become someone new as fallen, finally, into a person I had been gradually approaching all my life.",
        "An ordinary Wednesday in 1989. I rose, looked out, and understood that the chapter of my life concerned with proving things to my father had concluded overnight.",
      ],
      es: [
        "La mañana después de que murió mami. Me senté en la cocina y supe: ya no soy hija. Ahora soy raíz.",
        "La mañana después de que se finalizó mi divorcio. Hice café. Supe que ya era otro. Me lo tomé.",
        "La mañana después de que nació mi hija. No me había convertido tanto en alguien nuevo, sino caído, por fin, en una persona a la que me había ido acercando toda mi vida.",
        "Un miércoles ordinario en 1989. Me levanté, miré afuera, y comprendí que el capítulo de mi vida dedicado a probarle cosas a mi padre había concluido durante la noche.",
      ],
    },
  },
  {
    id: 239,
    category: "love",
    depth: "texture",
    en: "What's a letter you've written that mattered? To whom?",
    es: "¿Qué carta has escrito que importó? ¿A quién?",
    randomizeOptions: {
      en: [
        "Una carta a mami el año antes de que muriera. Le dije lo que nunca le había dicho. La leyó. La guardó. La encontré.",
        "Wrote a letter to my old man two weeks before he passed. Not sure he read it. Glad I sent it.",
        "A letter to a friend whose father had just died, in 1998. I wrote it three times. She has, I learned later, kept the third version in a drawer.",
        "A letter to my future self at twenty, sealed for thirty years, opened on the appointed day. The writer, in retrospect, was both more and less correct than I had supposed.",
      ],
      es: [
        "Una carta a mami el año antes de que muriera. Le dije lo que nunca le había dicho. La leyó. La guardó. La encontré.",
        "Le escribí una carta a mi viejo dos semanas antes de irse. No estoy seguro de que la leyera. Me alegra haberla mandado.",
        "Una carta a una amiga cuyo padre acababa de morir, en 1998. La escribí tres veces. Ella, supe luego, ha guardado la tercera versión en un cajón.",
        "Una carta a mi yo futuro a los veinte, sellada durante treinta años, abierta en la fecha acordada. El escritor, en retrospectiva, tenía más y menos razón de la que yo había supuesto.",
      ],
    },
  },
  {
    id: 240,
    category: "values",
    depth: "depth",
    en: "If you could undo one thing in your life, what would it be? Or wouldn't you?",
    es: "Si pudieras deshacer una cosa de tu vida, ¿cuál sería? ¿O no lo harías?",
    randomizeOptions: {
      en: [
        "No haberme callado el día que mi padre habló mal de mami. Hubiera querido defenderla. Pero no. No. Lo dejo. Cada cosa que pasó me trajo aquí.",
        "Wouldn't undo it. Whole life got me to the kitchen this morning. Don't mess with that.",
        "I'd undo a particular silence at twenty-eight. The undoing would change downstream things I love. So perhaps, on second thought, I wouldn't.",
        "I would, were the universe so accommodating, retract a sentence I uttered to my brother in 1977. The remainder I leave, in good faith, alone.",
      ],
      es: [
        "No haberme callado el día que mi papá habló mal de mami. Hubiera querido defenderla. Pero no. No. Lo dejo. Cada cosa que pasó me trajo aquí.",
        "No lo deshago. Toda la vida me llevó a la cocina esta mañana. No lo toco.",
        "Deshacería cierto silencio a los veintiocho. Deshacerlo cambiaría cosas posteriores que amo. Así que, pensándolo mejor, tal vez no.",
        "Retiraría, si el universo fuera tan complaciente, una oración que le dije a mi hermano en 1977. Lo demás lo dejo, de buena fe, en paz.",
      ],
    },
  },
  {
    id: 241,
    category: "place",
    depth: "texture",
    en: "Is there a hill, mountain, or high place that means something to you?",
    es: "¿Hay un cerro, una montaña o un lugar alto que signifique algo para ti?",
    randomizeOptions: {
      en: [
        "El Pan de Matanzas. Subí con mami a los doce. Nunca más volví. Pero lo subí.",
        "Bluff outside town. Used to go with my old man. Don't go anymore. Sometimes I drive past.",
        "A small hill behind the cabin we rented one summer in '92. I climbed it alone every morning. I've never been the same.",
        "A particular peak in the Adirondacks ascended in 1953. The view, on that day, became, somehow, an inner reference point.",
      ],
      es: [
        "El Pan de Matanzas. Subí con mami a los doce. Nunca más volví. Pero lo subí.",
        "El cerro afuera del pueblo. Iba con mi viejo. Ya no voy. A veces paso manejando.",
        "Una colina chica detrás de la cabaña que rentamos un verano en el 92. La subía sola cada mañana. No he vuelto a ser la misma.",
        "Un pico particular en los Adirondacks ascendido en 1953. La vista, ese día, se convirtió, de algún modo, en un punto de referencia interior.",
      ],
    },
  },
  {
    id: 242,
    category: "love",
    depth: "texture",
    en: "What's the kindest thing a child has ever said or done for you?",
    es: "¿Cuál es la cosa más bondadosa que un niño te ha dicho o hecho?",
    randomizeOptions: {
      en: [
        "Mi nieta me dijo a los seis: 'Abuela, no te mueras.' Le prometí que no, aunque sabía que era mentira. Pero ese momento.",
        "Buddy's kid handed me his last cookie. Whole cookie. Didn't want it. Gave it anyway.",
        "A friend's eight-year-old told me \"you don't have to talk if you don't want to\" at a party I was struggling at. I have not, since, undervalued small mercies.",
        "A grandnephew said, on a winter evening, \"You can have my chair, you're old.\" The honesty of the gift was the gift.",
      ],
      es: [
        "Mi nieta me dijo a los seis: 'Abuela, no te mueras.' Le prometí que no, aunque sabía que era mentira. Pero ese momento.",
        "El hijo de un cuate me dio su última galleta. Entera. No la quería. Me la dio de todas formas.",
        "El hijo de ocho años de un amigo me dijo \"no tienes que hablar si no quieres\" en una fiesta en la que la estaba pasando mal. No he, desde entonces, subestimado las pequeñas misericordias.",
        "Un sobrino-nieto dijo, una noche de invierno: \"Puedes tener mi silla, eres viejo.\" La honestidad del regalo fue el regalo.",
      ],
    },
  },
  {
    id: 243,
    category: "values",
    depth: "depth",
    en: "Is there a prayer, a thought, or a phrase you used to repeat that you've stopped saying? Why?",
    es: "¿Hay una oración, un pensamiento o una frase que solías repetir y dejaste de decir? ¿Por qué?",
    randomizeOptions: {
      en: [
        "'Si Dios quiere.' Lo dejé un tiempo cuando mami se enfermó. Era pelear con Dios. Después regresé al rezo, distinta.",
        "Used to say \"life's not fair.\" Stopped. Didn't help.",
        "I used to say \"things happen for a reason.\" I stopped after a particular Tuesday in 2014. The world is not, in fact, that organized.",
        "A piece of liturgy I once recited, in 1953, with a confidence that has since been refined into something altogether more modest.",
      ],
      es: [
        "'Si Dios quiere.' Lo dejé un tiempo cuando mami se enfermó. Era pelear con Dios. Después regresé al rezo, distinta.",
        "Solía decir \"la vida no es justa.\" Dejé de decirlo. No ayudaba.",
        "Solía decir \"las cosas pasan por algo.\" Dejé de hacerlo después de cierto martes en 2014. El mundo no está, de hecho, tan organizado.",
        "Una pieza de liturgia que una vez recité, en 1953, con una confianza que desde entonces se ha refinado en algo notablemente más modesto.",
      ],
    },
  },
  {
    id: 244,
    category: "self",
    depth: "texture",
    en: "What does your kitchen sound like in the morning?",
    es: "¿A qué suena tu cocina en la mañana?",
    randomizeOptions: {
      en: [
        "La cafetera. La radio bajita. Mis pantuflas. Un suspiro.",
        "Coffee dripping. News at low volume. Refrigerator humming.",
        "A kettle, a clock that ticks audibly, NPR on a low murmur, my partner reading aloud the headline they want me to argue with.",
        "The quiet whirr of a particular appliance, the chime of the half-hour, and the unhurried turning of a newspaper page.",
      ],
      es: [
        "La cafetera. La radio bajita. Mis pantuflas. Un suspiro.",
        "El café goteando. Las noticias bajitas. El refri zumbando.",
        "Una tetera, un reloj que tictaquea audiblemente, NPR como murmullo, mi pareja leyendo en voz alta el encabezado con el que quieren que discuta.",
        "El zumbido tranquilo de cierto electrodoméstico, la campanada de la media hora, y el giro sin prisa de una página de periódico.",
      ],
    },
  },
  {
    id: 245,
    category: "stories",
    depth: "texture",
    en: "Have you ever met a famous person briefly? What was the moment?",
    es: "¿Has conocido brevemente a alguien famoso? ¿Cómo fue ese momento?",
    randomizeOptions: {
      en: [
        "Le di la mano a Olga Guillot en un restaurante. Lloré después. Mi mami no me lo creyó.",
        "Met a senator at the auto show. Tall guy. Dead handshake. Wasn't impressed.",
        "I once shared an elevator with a writer whose book had wrecked me at twenty-three. I said nothing. He nodded. I think we both preferred it that way.",
        "I was, in 1977, briefly introduced to a particular novelist. I was, on that day, struck dumb. The novelist, with elegance, supplied the conversation.",
      ],
      es: [
        "Le di la mano a Olga Guillot en un restaurante. Lloré después. Mi mami no me lo creyó.",
        "Conocí a un senador en el auto show. Tipo alto. Saludo de mano flojo. No me impresionó.",
        "Una vez compartí un elevador con un escritor cuyo libro me había destrozado a los veintitrés. No dije nada. Él asintió. Creo que los dos lo preferimos así.",
        "Fui, en 1977, brevemente presentado a cierta novelista. Esa día me quedé mudo. La novelista, con elegancia, suministró la conversación.",
      ],
    },
  },
  {
    id: 246,
    category: "family",
    depth: "texture",
    en: "Tell me about a moment with a mother-in-law, father-in-law, or in-law that surprised you.",
    es: "Cuéntame de un momento con tu suegra, suegro, o cuñado/a que te sorprendió.",
    randomizeOptions: {
      en: [
        "Mi suegra, después de años de trato frío, me agarró la mano antes de morir y me dijo 'gracias.' Eso fue todo. Eso fue mucho.",
        "Father-in-law took me out for a beer when my old man died. Didn't say much. Said enough.",
        "My mother-in-law, after a year of formality, gave me a recipe of hers in a card with a single line: \"Welcome.\"",
        "My late wife's father, on the morning of our wedding, conveyed to me, in a single sentence, the instructions for taking care of his daughter. I have, to the best of my ability, observed them.",
      ],
      es: [
        "Mi suegra, después de años de trato frío, me agarró la mano antes de morir y me dijo 'gracias.' Eso fue todo. Eso fue mucho.",
        "Mi suegro me sacó por una cerveza cuando murió mi viejo. No dijo mucho. Dijo lo suficiente.",
        "Mi suegra, tras un año de formalidad, me dio una receta suya en una tarjeta con una sola línea: \"Bienvenida.\"",
        "El padre de mi difunta esposa, la mañana de nuestra boda, me transmitió, en una sola oración, las instrucciones para cuidar de su hija. Las he, en lo que cabe, observado.",
      ],
    },
  },
  {
    id: 247,
    category: "self",
    depth: "depth",
    en: "What do you actually fear — the kind of fear you don't bring up?",
    es: "¿A qué le tienes miedo de verdad — del miedo que no se menciona?",
    randomizeOptions: {
      en: [
        "Quedarme sin la cabeza. Que se me olvide quien soy. Más que la muerte.",
        "Outliving my kids. Don't say it. Don't think about it long.",
        "Becoming small in a way I can't see. Withering toward irrelevance without noticing it. That one's mine.",
        "The day on which I no longer recognize the people who loved me. I have, on this matter, made what arrangements I can.",
      ],
      es: [
        "Quedarme sin la cabeza. Que se me olvide quién soy. Más que la muerte.",
        "Sobrevivir a mis hijos. No lo digo. No lo pienso mucho.",
        "Hacerme pequeña de una forma que no pueda ver. Marchitarme hacia la irrelevancia sin notarlo. Ese es mío.",
        "El día en que ya no reconozca a las personas que me amaron. He, sobre esta cuestión, hecho los arreglos que he podido.",
      ],
    },
  },
  {
    id: 248,
    category: "place",
    depth: "texture",
    en: "Tell me about an aunt or uncle's house — what it smelled like, what was on the wall, what the rule was.",
    es: "Cuéntame de la casa de una tía o tío — a qué olía, qué había en las paredes, cuál era la regla.",
    randomizeOptions: {
      en: [
        "Tía Olga. Olía a Maja y a galletas. Una imagen del Sagrado Corazón. La regla: nadie habla durante la novela.",
        "Uncle Ray. Smelled like motor oil and Folgers. Posters of cars from '78. Rule: don't sit on the good chair.",
        "An aunt's apartment in Brooklyn. Mothballs and bergamot. A wall of paintings she'd bought herself. Rule: shoes off, no exceptions.",
        "My great-uncle's study. Pipe tobacco and beeswax. The wall hosted a small Hopper print. The rule was a respectful quiet.",
      ],
      es: [
        "Tía Olga. Olía a Maja y a galletas. Una imagen del Sagrado Corazón. La regla: nadie habla durante la novela.",
        "Tío Ray. Olía a aceite de motor y Folgers. Pósters de carros del 78. Regla: no te sientes en la silla buena.",
        "El apartamento de una tía en Brooklyn. Naftalina y bergamota. Una pared con cuadros que ella se había comprado. Regla: zapatos fuera, sin excepción.",
        "El estudio de mi tío abuelo. Tabaco de pipa y cera de abeja. La pared albergaba un pequeño grabado de Hopper. La regla era un silencio respetuoso.",
      ],
    },
  },
  {
    id: 249,
    category: "work",
    depth: "depth",
    en: "Have you ever been fired or pushed out? What did it teach you?",
    es: "¿Te han despedido o sacado de un trabajo? ¿Qué te enseñó?",
    randomizeOptions: {
      en: [
        "Una jefa cruel me sacó. Lo cargué un año pensando que era yo. No era yo. Aprendí a creerme cuando algo está mal.",
        "Got let go in '08. Plant closed. Wasn't personal. Felt personal. Got over it.",
        "Was, gracefully but firmly, asked to step away from a role at thirty-three. The push opened the work that became my life. I don't recommend it; I don't, however, regret it.",
        "I was, in 1981, dismissed under a pretext. The dismissal, with time, has revealed itself to have been a quiet mercy.",
      ],
      es: [
        "Una jefa cruel me sacó. Lo cargué un año pensando que era yo. No era yo. Aprendí a creerme cuando algo está mal.",
        "Me corrieron en el 08. La planta cerró. No fue personal. Se sintió personal. Lo superé.",
        "Me pidieron, con gracia pero con firmeza, dejar un puesto a los treinta y tres. El empujón abrió el trabajo que se volvió mi vida. No lo recomiendo; no, sin embargo, me arrepiento.",
        "Fui, en 1981, despedido con un pretexto. El despido, con el tiempo, se ha revelado como una callada misericordia.",
      ],
    },
  },
  {
    id: 250,
    category: "self",
    depth: "texture",
    en: "Is there a phrase in a language you don't speak that lives in your head?",
    es: "¿Hay una frase en un idioma que no hablas que vive en tu cabeza?",
    randomizeOptions: {
      en: [
        "'Saudade.' Portugués. No tengo palabra para eso en español. Pero la siento todos los días.",
        "\"Y'all alright?\" my Vietnamese co-worker would say. He couldn't say much else. It was enough.",
        "\"Hiraeth\" — Welsh. A homesickness for a place that may not exist anymore. I have lived inside that word for twenty years.",
        "A line of Goethe I have not, despite a creditable German, ever fully translated to my satisfaction. The line is, on certain afternoons, my company.",
      ],
      es: [
        "'Saudade.' Portugués. No tengo palabra para eso en español. Pero la siento todos los días.",
        "\"Y'all alright?\" decía mi compañero vietnamita. No podía decir mucho más. Era suficiente.",
        "\"Hiraeth\" — galés. Una nostalgia por un lugar que tal vez ya no exista. He vivido dentro de esa palabra veinte años.",
        "Un verso de Goethe que no he, a pesar de un alemán aceptable, traducido nunca a mi entera satisfacción. El verso es, en ciertas tardes, mi compañía.",
      ],
    },
  },
  {
    id: 251,
    category: "values",
    depth: "depth",
    en: "What's something you've earned that didn't come easy?",
    es: "¿Qué has ganado que no fue fácil?",
    randomizeOptions: {
      en: [
        "La paz con mi madre. Cuarenta años. Lo gané. Y ella también.",
        "My sobriety. Day by day. Twenty years. Earned it.",
        "A friendship I had to apologize for, twice, to keep. The friendship, today, is my best one.",
        "A modicum of patience with my own mind. The expense, on a per-year basis, has not been small.",
      ],
      es: [
        "La paz con mi madre. Cuarenta años. La gané. Y ella también.",
        "Mi sobriedad. Día por día. Veinte años. Me la gané.",
        "Una amistad por la que tuve que pedir perdón, dos veces, para conservarla. La amistad, hoy, es la mejor que tengo.",
        "Una pizca de paciencia con mi propia mente. El gasto, por año, no ha sido pequeño.",
      ],
    },
  },
  {
    id: 252,
    category: "self",
    depth: "texture",
    en: "Do you have a tattoo or a mark on your body with a story? Tell me.",
    es: "¿Tienes un tatuaje o una marca con historia? Cuéntame.",
    randomizeOptions: {
      en: [
        "No tengo tatuaje pero tengo una cicatriz en el pecho de cuando me operaron del corazón. Le digo 'mi medalla.'",
        "Anchor on my arm. Navy. Don't talk about it.",
        "A small line on my wrist from a knife I shouldn't have been holding at thirteen. I don't tell most people. I'm telling you.",
        "A small mark on my left forearm, the souvenir of a particular afternoon in 1957 that I have, for sixty-seven years, declined to fully explain.",
      ],
      es: [
        "No tengo tatuaje pero tengo una cicatriz en el pecho de cuando me operaron del corazón. Le digo 'mi medalla.'",
        "Un ancla en el brazo. Marina. No hablo de eso.",
        "Una línea pequeña en la muñeca de un cuchillo que no debí estar agarrando a los trece. No le cuento a casi nadie. Te estoy contando a ti.",
        "Una marca pequeña en mi antebrazo izquierdo, el souvenir de cierta tarde en 1957 que, durante sesenta y siete años, he declinado explicar del todo.",
      ],
    },
  },
  {
    id: 253,
    category: "stories",
    depth: "texture",
    en: "Tell me about a road trip — where to, who with, what you remember.",
    es: "Cuéntame de un viaje por carretera — adónde, con quién, qué recuerdas.",
    randomizeOptions: {
      en: [
        "Con Hector y los nenes a las Carolinas. Paramos en cada McDonald's. Mi nena vomitó una vez. Reímos hasta llegar.",
        "Drove to Florida with Eddie when we were nineteen. No money. Slept in the truck. Best week.",
        "A drive through New Mexico with my best friend at thirty-one. We stopped at every state historical marker. We have not, since, found a better trip.",
        "A 1962 cross-country, in a car that should not, on reflection, have made it. We arrived. The car did not.",
      ],
      es: [
        "Con Hector y los nenes a las Carolinas. Paramos en cada McDonald's. Mi nena vomitó una vez. Reímos hasta llegar.",
        "Manejé a Florida con Eddie a los diecinueve. Sin dinero. Dormimos en la camioneta. La mejor semana.",
        "Un manejo por Nuevo México con mi mejor amiga a los treinta y uno. Paramos en cada marcador histórico. No hemos encontrado, desde entonces, un viaje mejor.",
        "Un viaje costa a costa en 1962, en un carro que no debió, pensándolo bien, llegar. Llegamos. El carro, no.",
      ],
    },
  },
  {
    id: 254,
    category: "love",
    depth: "soul",
    en: "Who would you want at your bedside?",
    es: "¿A quién querrías a tu lado en la cama, al final?",
    randomizeOptions: {
      en: [
        "Mi hija. Mi nieta. Una vela. La canción 'Bésame mucho' bajita. Eso basta.",
        "Wife. Kids. Don't need anyone else.",
        "My closest friend. My sister. The smell of bread baking somewhere in the house. Music low.",
        "My wife of fifty-five years, a window cracked, the morning light, and silence sufficient to hear the world breathing.",
      ],
      es: [
        "Mi hija. Mi nieta. Una vela. La canción 'Bésame mucho' bajita. Es suficiente.",
        "Mi esposa. Mis hijos. No necesito a nadie más.",
        "Mi amiga más cercana. Mi hermana. El olor de pan horneándose en alguna parte de la casa. Música bajita.",
        "Mi esposa de cincuenta y cinco años, una ventana entreabierta, la luz de la mañana, y silencio suficiente para oír al mundo respirar.",
      ],
    },
  },
  {
    id: 255,
    category: "place",
    depth: "texture",
    en: "Is there a church, temple, or place of worship that's lived in you, even if you don't go now?",
    es: "¿Hay una iglesia, templo, o lugar de fe que vive en ti, aunque ya no vayas?",
    randomizeOptions: {
      en: [
        "La iglesia del Cobre en Hialeah. Aún voy. Ahí me bautizaron a mis hijos. Me voy a despedir desde ahí.",
        "Catholic church on Pine Street. Don't go anymore. Sometimes I drive past at night.",
        "A small chapel on a college campus, in 1991. I have not, in years, stepped inside. The chapel has, nevertheless, remained inside me.",
        "An old stone church in a particular village in Wales. I have, in a long life, attended four times; the four visits have, between them, accomplished a year's worth of prayer.",
      ],
      es: [
        "La iglesia del Cobre en Hialeah. Aún voy. Ahí bauticé a mis hijos. Me voy a despedir desde ahí.",
        "La iglesia católica en Pine Street. Ya no voy. A veces paso manejando de noche.",
        "Una capilla pequeña en un campus universitario, en 1991. No he, en años, vuelto a entrar. La capilla, sin embargo, se ha quedado en mí.",
        "Una vieja iglesia de piedra en cierto pueblo de Gales. He asistido, en una larga vida, cuatro veces; las cuatro visitas han, entre ellas, logrado el equivalente de un año de oración.",
      ],
    },
  },
  {
    id: 256,
    category: "self",
    depth: "depth",
    en: "What has aging given you that the younger you would not have believed?",
    es: "¿Qué te ha dado envejecer que tu yo joven no habría creído?",
    randomizeOptions: {
      en: [
        "La capacidad de no preocuparme por lo que piensan los demás. A los veinte yo me hubiera reído. Pero llegó.",
        "Quiet. Plain quiet. Younger me would've called it boring. Younger me was an idiot.",
        "A genuine, unforced ability to enjoy a Tuesday afternoon. I would not, at twenty-five, have believed it possible.",
        "The dignity, finally, of not having to be interesting. The relief, in seven decades, has steadily increased.",
      ],
      es: [
        "La capacidad de no preocuparme por lo que piensan los demás. A los veinte yo me hubiera reído. Pero llegó.",
        "Silencio. Silencio puro. Mi yo joven lo hubiera llamado aburrido. Mi yo joven era un tonto.",
        "Una habilidad genuina, sin esfuerzo, de disfrutar un martes en la tarde. No lo habría creído posible a los veinticinco.",
        "La dignidad, por fin, de no tener que ser interesante. El alivio, en siete décadas, ha aumentado constantemente.",
      ],
    },
  },
  {
    id: 257,
    category: "family",
    depth: "texture",
    en: "Was there a cousin you grew up alongside, more like a sibling? What were they like?",
    es: "¿Hubo un primo con quien creciste, casi como hermano? ¿Cómo era?",
    randomizeOptions: {
      en: [
        "Mi prima Yoli. Mismo año. Misma escuela. Misma cuadra. La extraño cada día. La voy a llamar.",
        "My cousin Joe. Year older than me. Took me fishing every summer. Buried him last year.",
        "My cousin Mara. We made a small civilization between her bedroom and mine. The civilization, in many ways, persists.",
        "A cousin of approximately my age, with whom I shared, in the summers of my childhood, a single bicycle and an extensive private vocabulary.",
      ],
      es: [
        "Mi prima Yoli. Mismo año. Misma escuela. Misma cuadra. La extraño cada día. La voy a llamar.",
        "Mi primo Joe. Un año mayor. Me llevaba a pescar cada verano. Lo enterré el año pasado.",
        "Mi prima Mara. Hicimos una pequeña civilización entre su cuarto y el mío. La civilización, de muchas maneras, persiste.",
        "Un primo de aproximadamente mi edad, con quien compartí, en los veranos de mi infancia, una sola bicicleta y un extenso vocabulario privado.",
      ],
    },
  },
  {
    id: 258,
    category: "stories",
    depth: "texture",
    en: "Tell me about a moment of music that found you when you needed it.",
    es: "Cuéntame de un momento musical que te encontró cuando lo necesitabas.",
    randomizeOptions: {
      en: [
        "Una guitarra en la calle, en Madrid, el año que mami se enfermó. Me senté en un banquito y lloré sin pena.",
        "Heard 'Thunder Road' on the radio the day I quit drinking. Stupid coincidence. Felt like a hand on my shoulder.",
        "A subway musician playing Chopin at midnight, sixteen years ago. I missed two trains to listen.",
        "A radio in a hospital corridor, in 1995, playing a Schubert lied at the precise moment I needed Schubert. The lied has, since, never failed me.",
      ],
      es: [
        "Una guitarra en la calle, en Madrid, el año que mami se enfermó. Me senté en un banquito y lloré sin pena.",
        "Oí 'Thunder Road' en la radio el día que dejé de beber. Coincidencia tonta. Se sintió como una mano en el hombro.",
        "Un músico del metro tocando Chopin a medianoche, hace dieciséis años. Perdí dos trenes para escuchar.",
        "Una radio en un pasillo de hospital, en 1995, tocando un lied de Schubert en el momento preciso en que necesitaba Schubert. El lied, desde entonces, nunca me ha fallado.",
      ],
    },
  },
  {
    id: 259,
    category: "self",
    depth: "surface",
    en: "What's a corny joke or saying you keep in your back pocket?",
    es: "¿Qué chiste o dicho cursi tienes guardado en el bolsillo?",
    randomizeOptions: {
      en: [
        "'Mira, mi vida — no hay mal que por bien no venga.' Lo digo cuando algo se rompe.",
        "\"Could be worse. Could be raining.\" Then it usually rains.",
        "\"That's a problem for tomorrow's [name].\" Always lands.",
        "\"What does not kill me has clearly insufficient ambition.\" The phrase is, on most days, sufficient company.",
      ],
      es: [
        "'Mira, mi vida — no hay mal que por bien no venga.' Lo digo cuando algo se rompe.",
        "\"Podría ser peor. Podría estar lloviendo.\" Y luego suele llover.",
        "\"Ese es un problema del [nombre] de mañana.\" Siempre pega.",
        "\"Lo que no me mata tiene, claramente, ambición insuficiente.\" La frase es, casi siempre, compañía suficiente.",
      ],
    },
  },
  {
    id: 260,
    category: "love",
    depth: "depth",
    en: "Have you had a friendship across a difference — class, age, faith, politics — that worked?",
    es: "¿Has tenido una amistad a través de una diferencia — clase, edad, fe, política — que funcionó?",
    randomizeOptions: {
      en: [
        "Mi amiga Ruth. Judía. Yo católica. Cuarenta años. La quiero más que a algunas primas.",
        "Buddy at the shop, voted opposite. Best friend I had at work. Don't know how. Just did.",
        "A friend twenty years older than me, with whom I have agreed on almost nothing and learned almost everything.",
        "A correspondent, by post and later by email, of decidedly different politics, with whom I have, for thirty-two years, sustained a pointed and useful conversation.",
      ],
      es: [
        "Mi amiga Ruth. Judía. Yo católica. Cuarenta años. La quiero más que a algunas primas.",
        "Un cuate del taller, votó al revés que yo. Mejor amigo que tuve en el trabajo. No sé cómo. Funcionó.",
        "Una amiga veinte años mayor que yo, con quien casi nunca he estado de acuerdo y de quien he aprendido casi todo.",
        "Un corresponsal, por correo postal y luego electrónico, de política decididamente distinta, con quien he sostenido, por treinta y dos años, una conversación afilada y útil.",
      ],
    },
  },
  {
    id: 261,
    category: "self",
    depth: "depth",
    en: "Is there something you can't watch on TV anymore, even if you used to love it?",
    es: "¿Hay algo que ya no puedes ver en la tele, aunque te encantaba?",
    randomizeOptions: {
      en: [
        "Las novelas. Mi mami las veía. Ahora me hacen llorar, no por la historia, por ella.",
        "Football. Used to watch every Sunday. Now I just don't.",
        "Romantic comedies. They used to soothe me. Now they sting in a way I can't fully name.",
        "A particular detective program on which my late wife and I once disagreed weekly. The program continues, unwatched, on a streaming service I refuse to discontinue.",
      ],
      es: [
        "Las novelas. Mi mami las veía. Ahora me hacen llorar, no por la historia, por ella.",
        "Football. Antes lo veía cada domingo. Ahora simplemente no.",
        "Las comedias románticas. Antes me reconfortaban. Ahora pican de una manera que no sé nombrar del todo.",
        "Cierto programa de detectives sobre el cual mi difunta esposa y yo discutíamos semanalmente. El programa continúa, sin ver, en un servicio de streaming que me niego a cancelar.",
      ],
    },
  },
  {
    id: 262,
    category: "family",
    depth: "texture",
    en: "If you have a sibling and they got married, tell me a moment from their wedding.",
    es: "Si tienes un hermano o hermana que se casó, cuéntame un momento de su boda.",
    randomizeOptions: {
      en: [
        "Cuando mi hermana se puso a llorar al ver a papá entrarla. Yo lloré también. Eso se me quedó.",
        "Brother got married in his backyard. Spilled beer on his shoes. We laughed all night.",
        "My sister, before walking down, looked at me and exhaled like a runner. I have, since, recognized that exhale in many other people on many other days.",
        "My brother, on the morning of his wedding in 1973, asked me, with surprising humility, whether he was making a mistake. He was not.",
      ],
      es: [
        "Cuando mi hermana se puso a llorar al ver a papá entrarla. Yo lloré también. Eso se me quedó.",
        "Mi hermano se casó en su patio. Se le tiró cerveza en los zapatos. Nos reímos toda la noche.",
        "Mi hermana, antes de caminar al altar, me miró y exhaló como una corredora. Desde entonces he reconocido esa exhalación en muchas otras personas en muchos otros días.",
        "Mi hermano, la mañana de su boda en 1973, me preguntó, con sorprendente humildad, si estaba cometiendo un error. No lo estaba.",
      ],
    },
  },
  {
    id: 263,
    category: "values",
    depth: "depth",
    en: "What's a mistake you made that, in retrospect, was the right thing to do?",
    es: "¿Qué error cometiste que, mirándolo ahora, fue lo correcto?",
    randomizeOptions: {
      en: [
        "Dejar a un hombre que mami quería que mantuviera. Pensé que era un error. No lo era. Eso me dio mi vida.",
        "Quit the plant in '93 with no plan. Mom thought I was nuts. Best move I ever made.",
        "Said yes to a job that was beneath my training. The job, somehow, taught me what my training had failed to.",
        "I declined, in 1979, a particular promotion. The decline, by every conventional measure, was a mistake. By the only measure that has, in retrospect, mattered, it was correct.",
      ],
      es: [
        "Dejar a un hombre que mami quería que mantuviera. Pensé que era un error. No lo era. Eso me dio mi vida.",
        "Renuncié a la planta en el 93 sin plan. Mi mamá pensó que estaba loco. La mejor movida que hice.",
        "Dije sí a un trabajo por debajo de mi formación. El trabajo, de algún modo, me enseñó lo que mi formación no había podido.",
        "Decliné, en 1979, cierto ascenso. El rechazo, por toda medida convencional, fue un error. Por la única medida que, en retrospectiva, ha importado, fue correcto.",
      ],
    },
  },
  {
    id: 264,
    category: "self",
    depth: "soul",
    en: "Tell me something your body has done that astonishes you.",
    es: "Cuéntame algo que tu cuerpo ha hecho que te asombre.",
    randomizeOptions: {
      en: [
        "Cargué a mi mami enferma de la cama al baño tres meses. Yo no sabía que aguantaba tanto. El cuerpo aguanta lo que el alma le pide.",
        "Worked sixty-hour weeks for ten years. Don't know how. Body did it.",
        "It carried me through grief that I, in my mind, could not have survived. The body, in this regard, knows things the mind has not yet discovered.",
        "It has, with no instruction from me, healed a great many things. The body's competence has, on the whole, exceeded its operator's.",
      ],
      es: [
        "Cargué a mami enferma de la cama al baño tres meses. No sabía que aguantaba tanto. El cuerpo aguanta lo que el alma le pide.",
        "Trabajé semanas de sesenta horas durante diez años. No sé cómo. El cuerpo lo hizo.",
        "Me cargó a través de un duelo que mi mente, por sí sola, no habría sobrevivido. El cuerpo, en este aspecto, sabe cosas que la mente aún no ha descubierto.",
        "Ha, sin instrucciones mías, sanado un gran número de cosas. La competencia del cuerpo ha, en general, excedido la de su operador.",
      ],
    },
  },
  {
    id: 265,
    category: "legacy",
    depth: "soul",
    en: "Is there a single sentence you'd want carved somewhere small? On a bench, in a garden, on a stone?",
    es: "¿Hay una sola oración que querrías grabada en algo pequeño? En una banca, un jardín, una piedra?",
    randomizeOptions: {
      en: [
        "'Quería bien.' Tres palabras. Eso es lo que quiero que diga.",
        "\"He showed up.\" That'll do.",
        "\"She kept the door open.\" That's enough; I don't need any more than that.",
        "\"Here lies one who attended.\" The verb is, after a long life, the only one I am sure of.",
      ],
      es: [
        "'Quería bien.' Tres palabras. Eso es lo que quiero que diga.",
        "\"Apareció.\" Con eso basta.",
        "\"Mantuvo la puerta abierta.\" Es suficiente; no necesito más que eso.",
        "\"Aquí yace alguien que atendió.\" El verbo es, tras una larga vida, el único del que estoy seguro.",
      ],
    },
  },

  // — Batch 10 (266–295) —
  {
    id: 266,
    category: "self",
    depth: "texture",
    en: "Tell me about your favorite chair, and why no one else gets to sit in it.",
    es: "Cuéntame de tu silla favorita, y por qué nadie más se sienta en ella.",
    randomizeOptions: {
      en: [
        "El sillón verde de la sala. Era de Hector. Yo me siento ahí cada noche. Si alguien se sienta, lo miro feo.",
        "La-Z-Boy. Brown one. Mine. Wife knows.",
        "A worn velvet armchair I bought at twenty-five. Has shaped to me. Anyone else in it looks suspended.",
        "A leather wing-back of considerable age. The chair has, by now, learned my shape. Other shapes, in it, are an irritation.",
      ],
      es: [
        "El sillón verde de la sala. Era de Hector. Me siento ahí cada noche. Si alguien se sienta, le miro feo.",
        "La-Z-Boy. La café. Mía. Mi esposa sabe.",
        "Una butaca de terciopelo gastada que compré a los veinticinco. Se moldeó a mí. Cualquier otro en ella se ve suspendido.",
        "Una butaca de cuero con respaldo alto, de considerable edad. La silla, a estas alturas, ha aprendido mi forma. Otras formas, en ella, son una irritación.",
      ],
    },
  },
  {
    id: 267,
    category: "stories",
    depth: "depth",
    en: "Was there a dance you didn't dance? Tell me about it.",
    es: "¿Hubo un baile que no bailaste? Cuéntame.",
    randomizeOptions: {
      en: [
        "Mi quinceañera. Mi papá no quiso bailar conmigo. Yo le dije después que era el peor recuerdo. No me contestó.",
        "Senior prom. Girl asked me. I said no. Stupid.",
        "A wedding at twenty-six. He held out his hand. I shook my head. I have, since, learned to dance, partly to undo that no.",
        "A cotillion in 1947 at which I, in a fit of inexplicable adolescent dignity, declined to dance. The girl, mercifully, found another partner. I have not.",
      ],
      es: [
        "Mi quinceañera. Mi papá no quiso bailar conmigo. Yo le dije después que era el peor recuerdo. No me contestó.",
        "Mi baile de prepa. Una niña me invitó. Dije que no. Tonto.",
        "Una boda a los veintiséis. Él extendió la mano. Yo negué con la cabeza. He aprendido, desde entonces, a bailar, en parte para deshacer ese no.",
        "Un cotillón en 1947 en el cual, en un ataque de inexplicable dignidad adolescente, decliné bailar. La muchacha, misericordiosamente, encontró otra pareja. Yo no.",
      ],
    },
  },
  {
    id: 268,
    category: "love",
    depth: "texture",
    en: "Whose hands — besides your mother's — do you remember vividly?",
    es: "¿De quién recuerdas vívidamente las manos — además de tu madre?",
    randomizeOptions: {
      en: [
        "Las de Hector. Manos grandes, ásperas, con una manchita azul de tinta cerca del pulgar.",
        "My old man's. Calloused. Black under the nails. Don't make hands like that anymore.",
        "A teacher's. Slim, ink-marked, gentle when she returned my paper. I have, in fact, modeled my own hands on hers.",
        "My wife's hands. Fine, capable, perpetually slightly cool. The hand on my forehead, on certain afternoons, is the entirety of my faith.",
      ],
      es: [
        "Las de Hector. Manos grandes, ásperas, con una manchita azul de tinta cerca del pulgar.",
        "Las de mi viejo. Callosas. Negras debajo de las uñas. Ya no hacen manos así.",
        "Las de una maestra. Delgadas, manchadas de tinta, gentiles cuando me regresaba mi trabajo. He, de hecho, modelado mis propias manos según las suyas.",
        "Las manos de mi esposa. Finas, capaces, perpetuamente algo frescas. La mano en mi frente, en ciertas tardes, es la totalidad de mi fe.",
      ],
    },
  },
  {
    id: 269,
    category: "self",
    depth: "depth",
    en: "What's something you outgrew without quite noticing when?",
    es: "¿Qué cosa dejaste atrás sin notar exactamente cuándo?",
    randomizeOptions: {
      en: [
        "El miedo a estar sola en mi casa. Antes me daba pánico. Ahora se me hace lo más sagrado.",
        "Caring what people thought about my truck. Or anything, really.",
        "The need to be the smartest person at the table. I don't even remember when it left.",
        "A youthful determination to be original. The determination has, with age, given way to a far more agreeable wish to be useful.",
      ],
      es: [
        "El miedo a estar sola en mi casa. Antes me daba pánico. Ahora me parece lo más sagrado.",
        "Que me importara lo que pensaran de mi camioneta. O de cualquier cosa, de verdad.",
        "La necesidad de ser la persona más inteligente en la mesa. Ni recuerdo cuándo se me fue.",
        "Una determinación juvenil de ser original. La determinación ha cedido, con la edad, a un deseo mucho más amable de ser útil.",
      ],
    },
  },
  {
    id: 270,
    category: "stories",
    depth: "texture",
    en: "When did you first feel like an actual grown-up?",
    es: "¿Cuándo te sentiste por primera vez como adulto de verdad?",
    randomizeOptions: {
      en: [
        "El día que firmé mi primera cuenta de luz. Treinta años. Tarde. Me reí sola.",
        "Day I signed for the truck. Twenty-six. Knew I owed somebody for the next six years.",
        "When I paid my own taxes for the first time. Twenty-eight. Felt absurd to be allowed.",
        "The afternoon, in 1957, on which I first sat alone in a leased flat. The aloneness, on that day, was a credential.",
      ],
      es: [
        "El día que firmé mi primera cuenta de luz. Treinta años. Tarde. Me reí sola.",
        "El día que firmé por la camioneta. Veintiséis. Supe que le debía a alguien los próximos seis años.",
        "Cuando pagué mis impuestos por primera vez. Veintiocho. Me pareció absurdo que me lo permitieran.",
        "La tarde, en 1957, en que me senté solo por primera vez en un piso rentado. La soledad, ese día, fue una credencial.",
      ],
    },
  },
  {
    id: 271,
    category: "stories",
    depth: "texture",
    en: "Tell me about a time you got food poisoning. Who do you blame?",
    es: "Cuéntame de una vez que te dio una intoxicación. ¿A quién culpas?",
    randomizeOptions: {
      en: [
        "El chivito en un puesto en Cuba. Tres días en cama. La culpa la tiene el chivito y mi orgullo.",
        "Bad shrimp at a wedding. Whole table got sick. We still talk about it.",
        "A chicken sandwich from a gas station at twenty-seven. The blame, I am willing to acknowledge, was distributed.",
        "An oyster, in 1969, of evidently misjudged provenance. I have not, since, ordered an oyster east of Long Island Sound.",
      ],
      es: [
        "El chivito en un puesto en Cuba. Tres días en cama. La culpa la tiene el chivito y mi orgullo.",
        "Un camarón malo en una boda. Toda la mesa se enfermó. Aún hablamos de eso.",
        "Un sándwich de pollo de una gasolinera a los veintisiete. La culpa, lo reconozco, estaba repartida.",
        "Una ostra, en 1969, de procedencia evidentemente mal juzgada. No he, desde entonces, pedido una ostra al este de Long Island Sound.",
      ],
    },
  },
  {
    id: 272,
    category: "self",
    depth: "texture",
    en: "What song plays in your head when nothing's playing?",
    es: "¿Qué canción suena en tu cabeza cuando no hay nada sonando?",
    randomizeOptions: {
      en: [
        "'La Bayamesa.' Vieja. De mi mami. Aún la canturreo limpiando.",
        "Same Springsteen riff. Forty years. Doesn't go away. Don't want it to.",
        "An old Sufjan track. It loops without my permission. I have, by now, made peace with the loop.",
        "A particular Bach prelude. The mind, on its own initiative, plays it. I do not protest.",
      ],
      es: [
        "'La Bayamesa.' Vieja. De mi mami. Aún la canturreo limpiando.",
        "El mismo riff de Springsteen. Cuarenta años. No se va. No quiero que se vaya.",
        "Una vieja canción de Sufjan. Se repite sin mi permiso. He, a estas alturas, hecho las paces con el bucle.",
        "Cierto preludio de Bach. La mente, por su propia iniciativa, lo toca. No protesto.",
      ],
    },
  },
  {
    id: 273,
    category: "self",
    depth: "depth",
    en: "What's a secret skill — something you can do that almost no one knows you can?",
    es: "¿Cuál es una habilidad secreta tuya — algo que sabes hacer y casi nadie sabe?",
    randomizeOptions: {
      en: [
        "Sé arreglar relojes. Mi tío me enseñó. Ningún nieto sabe. Yo sé.",
        "Whittle. Make a wooden spoon in an evening. Don't tell anyone. Don't have to.",
        "I do impressions of people I know — distressingly accurate ones. My partner has asked me to keep this gift discreet.",
        "I have, for forty years, set type by hand on a small private press. Almost no one in my acquaintance has been told.",
      ],
      es: [
        "Sé arreglar relojes. Mi tío me enseñó. Ningún nieto sabe. Yo sé.",
        "Tallo madera. Hago una cuchara en una tarde. No le digo a nadie. No hace falta.",
        "Imito a personas que conozco — imitaciones inquietantemente precisas. Mi pareja me ha pedido conservar este don con discreción.",
        "He, durante cuarenta años, compuesto tipo a mano en una pequeña prensa privada. Casi nadie en mi círculo lo sabe.",
      ],
    },
  },
  {
    id: 274,
    category: "family",
    depth: "texture",
    en: "What's something you remember your father doing with his hands?",
    es: "¿Qué recuerdas que hacía tu padre con las manos?",
    randomizeOptions: {
      en: [
        "Liar nudos. Aprendí mirándolo. No sé hacer ni la mitad de los que él sabía.",
        "Sharpened his own knives. Sunday after dinner. Hated to do it. Did it anyway.",
        "Repaired books — bound them with thread, weighted them with iron, returned them as new. I learned later he was self-taught.",
        "Wound the grandfather clock every Sunday at six. The motion was so habitual it survived, in my own hand, into a clock he never owned.",
      ],
      es: [
        "Liar nudos. Aprendí viéndolo. No sé hacer ni la mitad de los que él sabía.",
        "Afilaba sus propios cuchillos. Domingo después de comer. No le gustaba. Lo hacía igual.",
        "Reparaba libros — los cosía con hilo, los presaba con hierro, los devolvía como nuevos. Supe luego que era autodidacta.",
        "Le daba cuerda al reloj de pie cada domingo a las seis. El gesto era tan habitual que sobrevivió, en mi propia mano, hasta un reloj que él nunca tuvo.",
      ],
    },
  },
  {
    id: 275,
    category: "love",
    depth: "depth",
    en: "Who have you fully forgiven — really, not just on paper?",
    es: "¿A quién has perdonado por completo — de verdad, no de mentirita?",
    randomizeOptions: {
      en: [
        "A mi padre. Tomó cuarenta años. Lo perdoné el día que murió. Y otra vez después.",
        "Old man. Forgave him after he died. Should've done it before. Didn't.",
        "A friend who hurt me deeply at twenty-eight. The forgiveness arrived, without warning, at forty-one. I had not, until then, known I was waiting.",
        "A particular relative whose unkindness, in 1968, had occupied a quiet corner of my heart. The release, when it came, was its own quiet vacation.",
      ],
      es: [
        "A mi padre. Tomó cuarenta años. Lo perdoné el día que murió. Y otra vez después.",
        "Mi viejo. Lo perdoné después de que murió. Debí haberlo hecho antes. No lo hice.",
        "Una amiga que me hirió profundamente a los veintiocho. El perdón llegó, sin aviso, a los cuarenta y uno. No había, hasta entonces, sabido que estaba esperando.",
        "Cierta pariente cuya falta de bondad, en 1968, había ocupado un rincón callado de mi corazón. La liberación, cuando llegó, fue sus propias vacaciones tranquilas.",
      ],
    },
  },
  {
    id: 276,
    category: "place",
    depth: "texture",
    en: "What's the stillest place you've ever been?",
    es: "¿Cuál es el lugar más quieto en el que has estado?",
    randomizeOptions: {
      en: [
        "La capilla del convento donde mi tía era monja. No oí mi propia respiración. Lo recuerdo todavía.",
        "Pre-dawn. Bass boat. Out on the lake. Mist on the water. Nothing.",
        "A bookstore in Edinburgh, last room, fourth floor. The world was, for an hour, audibly elsewhere.",
        "A cloister in Tuscany at noon, in 1979. The silence was not, on inspection, the absence of sound. It was a presence.",
      ],
      es: [
        "La capilla del convento donde mi tía era monja. No oí mi propia respiración. La recuerdo todavía.",
        "Antes del amanecer. Lancha de pesca. En el lago. Niebla en el agua. Nada.",
        "Una librería en Edimburgo, último cuarto, cuarto piso. El mundo estaba, por una hora, audiblemente en otra parte.",
        "Un claustro en la Toscana al mediodía, en 1979. El silencio no era, mirado de cerca, la ausencia de sonido. Era una presencia.",
      ],
    },
  },
  {
    id: 277,
    category: "family",
    depth: "depth",
    en: "What's something true about your siblings you'd never say to them out loud?",
    es: "¿Qué verdad sobre tus hermanos nunca les dirías en voz alta?",
    randomizeOptions: {
      en: [
        "Que mi hermana se cree fuerte y no lo es. Y la quiero más por eso.",
        "Brother's funnier than he thinks. Wouldn't tell him. Don't want him to know.",
        "That my sister was, and is, the more interesting one. I have, in our long parallel lives, been the steady one. She has been the truer one.",
        "That my brother — long the family disappointment — is, in fact, the most morally serious of any of us. I shall not say so. He prefers to be misunderstood.",
      ],
      es: [
        "Que mi hermana se cree fuerte y no lo es. Y la quiero más por eso.",
        "Mi hermano es más chistoso de lo que cree. No le digo. No quiero que sepa.",
        "Que mi hermana fue, y es, la más interesante. He sido, en nuestras largas vidas paralelas, la estable. Ella ha sido la más verdadera.",
        "Que mi hermano — largamente la decepción familiar — es, de hecho, el más serio moralmente de todos nosotros. No lo diré. Prefiere ser malentendido.",
      ],
    },
  },
  {
    id: 278,
    category: "place",
    depth: "texture",
    en: "If someone visits you for the first time, where do you take them first?",
    es: "Si alguien te visita por primera vez, ¿a dónde lo llevas primero?",
    randomizeOptions: {
      en: [
        "A la cocina. Café primero. Después la cama está hecha y la sala arreglada para que lo vea cuando llegue.",
        "Out to the porch. Beer in hand. Talk easier out there.",
        "To the bookshelf. I show people what I've been reading. It's how I know if we'll be friends.",
        "The garden. Whatever the season, the garden tells the visitor more about me, in five minutes, than I can in five years.",
      ],
      es: [
        "A la cocina. Café primero. Después la cama está hecha y la sala arreglada para que lo vea al llegar.",
        "Al porche. Cerveza en la mano. Es más fácil hablar afuera.",
        "Al librero. Le enseño qué he estado leyendo. Es como sé si vamos a ser amigos.",
        "El jardín. Sea cual sea la temporada, el jardín le dice al visitante más sobre mí, en cinco minutos, de lo que yo puedo en cinco años.",
      ],
    },
  },
  {
    id: 279,
    category: "stories",
    depth: "depth",
    en: "When did you realize you were, in fact, strong?",
    es: "¿Cuándo te diste cuenta de que, de verdad, eras fuerte?",
    randomizeOptions: {
      en: [
        "Cuando salí del hospital cargando a mi nena después de un parto difícil. Sola. Y caminé.",
        "After dad died. Funeral. Spoke. Drove home. Cooked dinner. Then I knew.",
        "Three weeks after a breakup that should have flattened me, when I made dinner for myself and laughed at something on the radio.",
        "Some morning in 2017, when, having slept badly, I rose and did, with unspectacular competence, what the day required.",
      ],
      es: [
        "Cuando salí del hospital cargando a mi nena después de un parto difícil. Sola. Y caminé.",
        "Después de que murió papá. Funeral. Hablé. Manejé a casa. Hice cena. Ahí supe.",
        "Tres semanas después de una ruptura que debió tirarme, cuando me hice cena y me reí de algo en la radio.",
        "Una mañana de 2017, cuando, habiendo dormido mal, me levanté e hice, con poco espectacular competencia, lo que el día requería.",
      ],
    },
  },
  {
    id: 280,
    category: "place",
    depth: "texture",
    en: "What color is your house, on the inside? What did you choose, and why?",
    es: "¿De qué color es tu casa por dentro? ¿Qué escogiste, y por qué?",
    randomizeOptions: {
      en: [
        "Amarillo claro. Como el sol. Como Cuba. Como mami. Mi sala todavía es amarilla.",
        "Beige. Don't pick fights with paint.",
        "A particular green I had to mix three times to get right. Cool, mossy, holds a candle well in winter.",
        "A warm white. The white of an old library. The white that, in changing light, never stays the same color twice.",
      ],
      es: [
        "Amarillo claro. Como el sol. Como Cuba. Como mami. Mi sala todavía es amarilla.",
        "Beige. No peleo con la pintura.",
        "Un verde particular que tuve que mezclar tres veces para que quedara. Fresco, musgoso, sostiene bien una vela en invierno.",
        "Un blanco cálido. El blanco de una biblioteca vieja. El blanco que, con la luz cambiante, nunca se queda del mismo color dos veces.",
      ],
    },
  },
  {
    id: 281,
    category: "self",
    depth: "depth",
    en: "What's the very first thought you have when you wake up?",
    es: "¿Cuál es el primer pensamiento que tienes al despertar?",
    randomizeOptions: {
      en: [
        "'Gracias.' Antes de los ojos. Lo aprendí de mami.",
        "\"Coffee.\" Then everything else.",
        "Some small calculation about who I owe a call. The list is short. I attend to it before getting up.",
        "An unbidden line from whatever I have most recently been reading. The mind, evidently, has its own agenda.",
      ],
      es: [
        "'Gracias.' Antes de los ojos. Lo aprendí de mami.",
        "\"Café.\" Después todo lo demás.",
        "Un pequeño cálculo sobre a quién debo una llamada. La lista es corta. La atiendo antes de levantarme.",
        "Una línea no invitada de lo que sea que haya estado leyendo más recientemente. La mente, evidentemente, tiene su propia agenda.",
      ],
    },
  },
  {
    id: 282,
    category: "self",
    depth: "texture",
    en: "What pair of shoes would you hand down, if anyone wanted them?",
    es: "¿Qué par de zapatos pasarías a alguien, si los quisiera?",
    randomizeOptions: {
      en: [
        "Mis zapatos de baile blancos. Los usé en mi boda. Si mi nieta los quiere, son suyos.",
        "Work boots. Twenty-three years on these. Got plenty of life left.",
        "A pair of leather oxfords I had resoled four times. If a younger version of me showed up, I'd give them these.",
        "A pair of brogues, custom-built in 1968, that have outlasted three other pairs. The grandson, if he wears my size, can have them.",
      ],
      es: [
        "Mis zapatos de baile blancos. Los usé en mi boda. Si mi nieta los quiere, son suyos.",
        "Las botas de trabajo. Veintitrés años con estas. Les queda bastante vida.",
        "Un par de oxford de cuero a los que les puse suela cuatro veces. Si una versión más joven de mí apareciera, le daría estos.",
        "Un par de brogues, hechos a la medida en 1968, que han sobrevivido a tres otros pares. El nieto, si calza mi número, puede llevárselos.",
      ],
    },
  },
  {
    id: 283,
    category: "stories",
    depth: "depth",
    en: "Has a chance encounter with a stranger ever changed something in you?",
    es: "¿Te ha cambiado algo un encuentro casual con un desconocido?",
    randomizeOptions: {
      en: [
        "Una mujer en un avión a los treinta. Le conté lo de mi mami. Me dijo: 'mi vida, los muertos quieren que sigamos.' Cambié.",
        "Cab driver in '98. Quoted scripture I'd been arguing with all week. Shut me right up.",
        "An older woman at a bus stop, who simply said \"oh, honey,\" when I was crying. The two words rearranged a year.",
        "A janitor at the library, in 1955, who quoted Yeats to me unbidden. The line has, since, run as a quiet companion.",
      ],
      es: [
        "Una mujer en un avión a los treinta. Le conté lo de mami. Me dijo: 'mi vida, los muertos quieren que sigamos.' Cambié.",
        "Un taxista en el 98. Me citó un pasaje con el que llevaba peleando toda la semana. Me calló.",
        "Una señora mayor en una parada de bus, que simplemente dijo \"ay, mi amor,\" cuando yo lloraba. Las dos palabras me reacomodaron un año.",
        "Un conserje en la biblioteca, en 1955, que me citó a Yeats sin que yo le pidiera. La línea ha corrido, desde entonces, como una callada compañía.",
      ],
    },
  },
  {
    id: 284,
    category: "love",
    depth: "texture",
    en: "Who's the first person you call when you've heard bad news?",
    es: "¿A quién llamas primero cuando recibes malas noticias?",
    randomizeOptions: {
      en: [
        "Mi hermana. Siempre. Ella sabe. Llora conmigo. No me da consejos.",
        "Wife. Don't even think about it.",
        "My oldest friend. She lets me say the worst version first, then the truer version comes out on its own.",
        "My brother, despite a thousand small disagreements. The competence of his silence has, over the years, become irreplaceable.",
      ],
      es: [
        "Mi hermana. Siempre. Ella sabe. Llora conmigo. No me da consejos.",
        "Mi esposa. Ni lo pienso.",
        "Mi amiga más vieja. Me deja decir la peor versión primero, después la versión más verdadera sale sola.",
        "Mi hermano, a pesar de mil pequeños desacuerdos. La competencia de su silencio se ha vuelto, con los años, irreemplazable.",
      ],
    },
  },
  {
    id: 285,
    category: "self",
    depth: "depth",
    en: "Is there a version of yourself that doesn't get out anymore? Tell me about them.",
    es: "¿Hay una versión de ti que ya no sale? Cuéntame de ella.",
    randomizeOptions: {
      en: [
        "La que iba a bailar todos los viernes. La extraño. Y la respeto. Pero ahora me siento yo en el sillón.",
        "Guy who could pull an all-nighter, fix a transmission, and still go to mass. He's in there. Doesn't come out as much.",
        "The me who could read for eight hours and not move. She's still in here, but my back has registered an objection.",
        "A young man, full of certainties, with whom I share an address but, on most days, very little else.",
      ],
      es: [
        "La que iba a bailar todos los viernes. La extraño. Y la respeto. Pero ahora me siento yo en el sillón.",
        "El que podía desvelarse, arreglar una transmisión, y aun así ir a misa. Sigue ahí. No sale tanto.",
        "La yo que podía leer ocho horas sin moverse. Sigue aquí adentro, pero mi espalda registró una objeción.",
        "Un joven, lleno de certezas, con quien comparto domicilio pero, en la mayoría de los días, muy poca otra cosa.",
      ],
    },
  },
  {
    id: 286,
    category: "self",
    depth: "texture",
    en: "What's your pace when you walk? Slow, fast, leisurely, with purpose?",
    es: "¿Cuál es tu ritmo al caminar? Lento, rápido, paseado, con propósito?",
    randomizeOptions: {
      en: [
        "Lento. A propósito. Quiero ver. La gente joven me pasa. Que pase.",
        "Fast. Always fast. Wife asks me to slow down. I don't.",
        "Steady, mid-tempo, with attention to what I'm passing. I have, in this respect, become my own grandmother.",
        "An unhurried gait that has, in recent decades, become something close to dignified — not by intention, but by the body's polite request.",
      ],
      es: [
        "Lento. A propósito. Quiero ver. Los jóvenes me pasan. Que pasen.",
        "Rápido. Siempre rápido. Mi esposa me pide que vaya más despacio. No.",
        "Constante, ritmo medio, con atención a lo que paso. Me he, en este aspecto, convertido en mi propia abuela.",
        "Un andar sin prisa que se ha vuelto, en las últimas décadas, algo cercano a digno — no por intención, sino por la cortés petición del cuerpo.",
      ],
    },
  },
  {
    id: 287,
    category: "stories",
    depth: "texture",
    en: "Have you ever watched a fight that wasn't yours and remembered it for years?",
    es: "¿Alguna vez viste una pelea que no era tuya y la recordaste por años?",
    randomizeOptions: {
      en: [
        "Mi mami y mi tía. Por una receta. Yo tenía siete años. No se hablaron seis meses. Por una receta.",
        "Two guys at a bar in '01. One bled into a pint glass. Don't remember why. Remember the glass.",
        "My parents arguing in low voices in the kitchen, 1992. The fight was about money. The lesson was about what happens to a marriage when the silences exceed the volume.",
        "A row, in 1958, between my father and his brother. The disagreement, on its surface, concerned a fence; on its substance, it concerned, of course, our mother.",
      ],
      es: [
        "Mi mami y mi tía. Por una receta. Yo tenía siete años. No se hablaron seis meses. Por una receta.",
        "Dos tipos en un bar en el 01. Uno sangró en un vaso de cerveza. No recuerdo por qué. Recuerdo el vaso.",
        "Mis padres discutiendo en voz baja en la cocina, 1992. La pelea era por dinero. La lección era qué le pasa a un matrimonio cuando los silencios exceden el volumen.",
        "Una riña, en 1958, entre mi padre y su hermano. El desacuerdo, en su superficie, era por una cerca; en su sustancia, era, por supuesto, por nuestra madre.",
      ],
    },
  },
  {
    id: 288,
    category: "love",
    depth: "texture",
    en: "What's a soup or food you make when someone you love is sick?",
    es: "¿Qué sopa o comida haces cuando alguien que quieres está enfermo?",
    randomizeOptions: {
      en: [
        "Sopa de pollo con fideos. La de mami. Le pongo limón al final. Cura.",
        "Chicken noodle. Not from a can. From scratch. That's all.",
        "A clear broth with rice and a little ginger. The recipe is a half-remembered one from my grandmother. It works.",
        "A consommé, simple and faintly herbal, that I learned to make in a hospital cafeteria one long Wednesday in 1989. The recipe survives me.",
      ],
      es: [
        "Sopa de pollo con fideos. La de mami. Le pongo limón al final. Cura.",
        "Sopa de pollo. No de lata. De cero. Eso es todo.",
        "Un caldo claro con arroz y un poco de jengibre. La receta es una a medias recordada de mi abuela. Funciona.",
        "Un consomé, simple y ligeramente herbáceo, que aprendí a hacer en la cafetería de un hospital un miércoles largo de 1989. La receta me sobrevive.",
      ],
    },
  },
  {
    id: 289,
    category: "family",
    depth: "depth",
    en: "What did your kids — or the kids in your life — take from you that surprised you?",
    es: "¿Qué tomaron tus hijos — o los niños en tu vida — de ti que te sorprendió?",
    randomizeOptions: {
      en: [
        "Mi paciencia. No la enseñé. La copiaron. Mejor que yo, además.",
        "My laugh. Hadn't realized it was teachable. Apparently it is.",
        "A way of watching people that I thought was mine. Apparently, it's now genetic.",
        "A particular small gesture I make at dinner — the lifting of a glass, the brief pause — has been, without instruction, taken up by my granddaughter.",
      ],
      es: [
        "Mi paciencia. No la enseñé. La copiaron. Mejor que yo, además.",
        "Mi risa. No sabía que se podía enseñar. Aparentemente sí.",
        "Una forma de mirar a la gente que creía mía. Aparentemente, ahora es genética.",
        "Un gesto pequeño que hago en la cena — alzar una copa, una pausa breve — ha sido, sin instrucción, adoptado por mi nieta.",
      ],
    },
  },
  {
    id: 290,
    category: "place",
    depth: "depth",
    en: "Is there a window you've cried looking out of? Where, when?",
    es: "¿Hay una ventana por la que has llorado mirando afuera? ¿Dónde, cuándo?",
    randomizeOptions: {
      en: [
        "La ventana del cuarto de mami en el hospital. Mirando los árboles. Pensando que ella nunca más los iba a ver.",
        "Window in the truck. Pulled over after my old man died. Sat there an hour.",
        "A window above a street in 2014. The street had nothing to do with the crying. The window was the witness.",
        "The window above my desk, on the morning of a particular telephone call in 1998. The view, I have, since, declined to redecorate.",
      ],
      es: [
        "La ventana del cuarto de mami en el hospital. Mirando los árboles. Pensando que ella nunca más los iba a ver.",
        "Ventana de la camioneta. Me orillé después de que murió mi viejo. Me quedé una hora.",
        "Una ventana sobre una calle en 2014. La calle no tenía nada que ver con el llanto. La ventana fue testigo.",
        "La ventana sobre mi escritorio, la mañana de cierta llamada telefónica en 1998. La vista no la he, desde entonces, redecorado.",
      ],
    },
  },
  {
    id: 291,
    category: "stories",
    depth: "texture",
    en: "What was the first time you wore a suit or a real dress for an occasion?",
    es: "¿Cuál fue la primera vez que usaste un traje o vestido formal para una ocasión?",
    randomizeOptions: {
      en: [
        "Mi quinceañera. Vestido rosa. Un guante en cada brazo. Mami lloró sin parar.",
        "First communion. Brown suit. Dad picked it. Knees shook.",
        "A black dress at twenty-two, for a funeral. The dress, on that day, became the first grown thing in my closet.",
        "A morning suit at sixteen, for a cousin's wedding in 1948. I felt, all afternoon, like a man pretending to be himself.",
      ],
      es: [
        "Mi quinceañera. Vestido rosa. Un guante en cada brazo. Mami lloró sin parar.",
        "Primera comunión. Traje café. Mi papá lo escogió. Me temblaban las rodillas.",
        "Un vestido negro a los veintidós, para un funeral. El vestido, ese día, se convirtió en la primera cosa adulta en mi clóset.",
        "Un morning suit a los dieciséis, para la boda de un primo en 1948. Me sentí, toda la tarde, como un hombre fingiendo ser él mismo.",
      ],
    },
  },
  {
    id: 292,
    category: "family",
    depth: "texture",
    en: "What perfume did your mother wear? Can you still smell it?",
    es: "¿Qué perfume usaba tu madre? ¿Aún lo puedes oler?",
    randomizeOptions: {
      en: [
        "Maja. Hasta el día que murió. Tengo el frasco. Lo abro una vez al año.",
        "Charlie. '70s. Still smell it sometimes. Don't know if it's real.",
        "Chanel No. 5, on Sundays only. The bottle, half-full, lives on a shelf I don't dust.",
        "A discontinued French scent the name of which I have, for fifty years, attempted to track down. The smell remains; the bottle has not.",
      ],
      es: [
        "Maja. Hasta el día que murió. Tengo el frasco. Lo abro una vez al año.",
        "Charlie. De los 70. Aún lo huelo a veces. No sé si es real.",
        "Chanel No. 5, sólo los domingos. El frasco, a la mitad, vive en un estante que no sacudo.",
        "Una fragancia francesa descontinuada cuyo nombre he, durante cincuenta años, intentado rastrear. El olor permanece; el frasco no.",
      ],
    },
  },
  {
    id: 293,
    category: "values",
    depth: "depth",
    en: "Is there something you regret not buying when you had the chance?",
    es: "¿Hay algo que te arrepientes de no haber comprado cuando pudiste?",
    randomizeOptions: {
      en: [
        "Una casita en Varadero. Tres mil dólares en el setenta y dos. Hubiéramos podido. No lo hicimos. Aún la sueño.",
        "An old Bronco. '78. Guy was selling it for cheap. Walked away. Idiot.",
        "A particular drawing in a flea market in '04. I've thought about it, idly, every year since.",
        "A small landscape by an unknown painter, offered to me, in 1972, for what would today be a trifling sum. The painting, in retrospect, was perhaps not the issue.",
      ],
      es: [
        "Una casita en Varadero. Tres mil dólares en el setenta y dos. Podíamos. No lo hicimos. Aún la sueño.",
        "Una Bronco vieja. Del 78. El cuate la vendía barata. Me fui. Tonto.",
        "Cierto dibujo en un mercado de pulgas en el 04. He pensado en él, distraídamente, cada año desde entonces.",
        "Un pequeño paisaje de un pintor desconocido, ofrecido en 1972 por lo que hoy sería una suma trivial. El cuadro, en retrospectiva, quizás no era el asunto.",
      ],
    },
  },
  {
    id: 294,
    category: "love",
    depth: "texture",
    en: "What's a phrase you say to your dog, cat, or pet — that you don't say to humans?",
    es: "¿Qué frase le dices a tu perro, gato o mascota — que no le dices a humanos?",
    randomizeOptions: {
      en: [
        "'Mi vida.' Toda persona y animal. Pero a la perrita se lo digo más.",
        "\"Don't be a jerk.\" Cat doesn't listen. Wife thinks it's funny.",
        "\"You're the best one of all of us, Bea.\" Bea is the dog. The dog knows.",
        "\"Carry on,\" addressed daily to the elderly retriever. He has, with quiet competence, complied for fifteen years.",
      ],
      es: [
        "'Mi vida.' A toda persona y animal. Pero a la perrita se lo digo más.",
        "\"No seas pesado.\" El gato no escucha. A mi esposa le da risa.",
        "\"Eres la mejor de todos nosotros, Bea.\" Bea es la perra. La perra lo sabe.",
        "\"Sigue,\" dicho diariamente al perdiguero anciano. Él ha, con callada competencia, obedecido durante quince años.",
      ],
    },
  },
  {
    id: 295,
    category: "self",
    depth: "soul",
    en: "If today were your last day, but you had to spend it ordinary — what would you do?",
    es: "Si hoy fuera tu último día, pero tuvieras que pasarlo ordinario — ¿qué harías?",
    randomizeOptions: {
      en: [
        "Café con mi hermana. Misa. Cocinar arroz con pollo. Llamar a mis nietos. Acostarme contenta.",
        "Coffee. Truck. Diner. My kids. Cold beer. Quiet. Done.",
        "A long walk, a long phone call with my best friend, soup for dinner, music while I clean the kitchen, and a book in bed.",
        "I should rise at the usual hour, write a letter, make a meal of moderate ambition, and read until quite late.",
      ],
      es: [
        "Café con mi hermana. Misa. Cocinar arroz con pollo. Llamar a mis nietos. Acostarme contenta.",
        "Café. Camioneta. Restaurante. Mis hijos. Una cerveza fría. Tranquilo. Listo.",
        "Una caminata larga, una llamada larga con mi mejor amiga, sopa de cena, música mientras limpio la cocina, y un libro en la cama.",
        "Me levantaría a la hora habitual, escribiría una carta, prepararía una comida de ambición moderada, y leería hasta bastante tarde.",
      ],
    },
  },

  // — Batch 11 (296–325) —
  {
    id: 296,
    category: "stories",
    depth: "depth",
    en: "Tell me about a moment in a hospital waiting room.",
    es: "Cuéntame de un momento en una sala de espera de hospital.",
    randomizeOptions: {
      en: [
        "Esperando que sacaran a mami de cirugía. Recé el rosario tres veces. Una enfermera me trajo un café que sabía a milagro.",
        "Sat there nine hours waiting on my old man. Read every magazine. Drank coffee that tasted like dirt.",
        "A friend's appendix at twenty-eight. The TV in the corner played a sitcom I have never been able to watch since.",
        "A long afternoon in 1992 in which I learned that the dignity of waiting is, in fact, an underrated skill.",
      ],
      es: [
        "Esperando que sacaran a mami de cirugía. Recé el rosario tres veces. Una enfermera me trajo un café que sabía a milagro.",
        "Estuve nueve horas esperando por mi viejo. Leí cada revista. Tomé café que sabía a tierra.",
        "El apéndice de un amigo a los veintiocho. La tele en la esquina pasaba una comedia que nunca he podido volver a ver.",
        "Una tarde larga en 1992 en la que aprendí que la dignidad de la espera es, de hecho, una habilidad subestimada.",
      ],
    },
  },
  {
    id: 297,
    category: "love",
    depth: "texture",
    en: "What song played at your wedding (or a wedding you remember)?",
    es: "¿Qué canción sonó en tu boda (o en una boda que recuerdas)?",
    randomizeOptions: {
      en: [
        "'Bésame mucho.' Hector me lo pidió. Lo bailamos despacio. Recuerdo cada nota.",
        "'Tupelo Honey,' Van Morrison. First dance. Wife picked it. Good pick.",
        "Nina Simone, 'Feeling Good.' We walked out to it. Half the room cried, including the bartender.",
        "A passage from Pachelbel. I have been, since 1968, less embarrassed by the cliché than amused by its persistence.",
      ],
      es: [
        "'Bésame mucho.' Hector me lo pidió. Lo bailamos despacio. Recuerdo cada nota.",
        "'Tupelo Honey,' de Van Morrison. Primer baile. Mi esposa la escogió. Buena elección.",
        "Nina Simone, 'Feeling Good.' Salimos con eso. Medio cuarto lloró, incluido el bartender.",
        "Un pasaje de Pachelbel. He estado, desde 1968, menos avergonzado por el cliché que divertido por su persistencia.",
      ],
    },
  },
  {
    id: 298,
    category: "stories",
    depth: "texture",
    en: "Have you ever saved an animal? What happened?",
    es: "¿Has salvado a un animal? ¿Qué pasó?",
    randomizeOptions: {
      en: [
        "Una palomita herida en mi patio. La cuidé tres semanas. Voló. Yo lloré.",
        "Pulled a stray dog out of traffic in '02. He stuck around. Buried him last year.",
        "A baby bird, fallen, that I returned to the nest with the help of a kitchen towel and a long ladder. The mother accepted him. I have never recovered.",
        "A spider on the bath, last week. The relocation, while undramatic, was, by my own measure, a kindness.",
      ],
      es: [
        "Una palomita herida en mi patio. La cuidé tres semanas. Voló. Yo lloré.",
        "Saqué a un perro callejero del tráfico en el 02. Se quedó. Lo enterré el año pasado.",
        "Un pajarito caído que regresé al nido con la ayuda de un trapo de cocina y una escalera larga. La madre lo aceptó. Yo nunca me he recuperado.",
        "Una araña en la tina, la semana pasada. La reubicación, aunque poco dramática, fue, según mi propia medida, un acto de bondad.",
      ],
    },
  },
  {
    id: 299,
    category: "family",
    depth: "texture",
    en: "What did your father teach you to fix — even if you weren't paying attention at the time?",
    es: "¿Qué te enseñó tu padre a arreglar — aunque no estuvieras prestando atención?",
    randomizeOptions: {
      en: [
        "Una llave goteando. Me enseñó a los doce. Lo hago igual que él. Misma posición, misma cara.",
        "Brakes. Watched him do it twenty times. Did it once when I needed to. Worked.",
        "A bicycle chain. I resented the lesson at twelve. I was, at thirty-two, grateful for it.",
        "A hinge, a fuse, a faulty switch. Small competencies that have, over decades, multiplied into a kind of inherited self-sufficiency.",
      ],
      es: [
        "Una llave goteando. Me enseñó a los doce. Lo hago igual que él. Misma posición, misma cara.",
        "Frenos. Lo vi hacerlo veinte veces. Lo hice una vez cuando lo necesité. Funcionó.",
        "La cadena de una bicicleta. Resentí la lección a los doce. Le agradecí, a los treinta y dos.",
        "Una bisagra, un fusible, un interruptor defectuoso. Pequeñas competencias que han, durante décadas, multiplicado una especie de auto-suficiencia heredada.",
      ],
    },
  },
  {
    id: 300,
    category: "love",
    depth: "depth",
    en: "Was there a love you didn't pursue? Why not?",
    es: "¿Hubo un amor que no perseguiste? ¿Por qué no?",
    randomizeOptions: {
      en: [
        "Un muchacho en mi pueblo. Me daba miedo lo intenso. Me casé con Hector, que era seguro. Nunca me arrepentí. Pero pienso en él.",
        "Girl in college. Didn't ask. Married someone else later. Wonder.",
        "A friend who, in my late twenties, turned briefly into something else. I did not act. The act, in retrospect, may have been the kinder choice.",
        "A particular woman in 1956 who, had I been less timid, might have made me a different man. The man I became has, on balance, been good company.",
      ],
      es: [
        "Un muchacho en mi pueblo. Me daba miedo lo intenso. Me casé con Hector, que era seguro. Nunca me arrepentí. Pero pienso en él.",
        "Una niña en la universidad. No le dije. Se casó con otro después. Me pregunto.",
        "Una amiga que, en mis veintiochos, se convirtió brevemente en otra cosa. No actué. El acto, en retrospectiva, pudo ser la elección más amable.",
        "Cierta mujer en 1956 que, de haber sido yo menos tímido, podría haberme hecho otro hombre. El hombre en que me convertí ha sido, en balance, buena compañía.",
      ],
    },
  },
  {
    id: 301,
    category: "place",
    depth: "texture",
    en: "Have you been somewhere at sunrise that you'll never forget?",
    es: "¿Has estado en algún lugar al amanecer que no olvidarás?",
    randomizeOptions: {
      en: [
        "El malecón de La Habana al amanecer. Yo tenía dieciocho. Estaba enamorada por primera vez. La luz era rosada.",
        "Top of a fire tower in West Virginia, '88. Sun came up. Whole valley lit up. Didn't say a word for an hour.",
        "A beach in Maine at five a.m., alone, in late September. The colors were obscene. I have been there in dreams since.",
        "The cathedral square in Florence, in 1972, the only soul awake. The stone, on that morning, was lavender.",
      ],
      es: [
        "El malecón de La Habana al amanecer. Yo tenía dieciocho. Estaba enamorada por primera vez. La luz era rosada.",
        "Encima de una torre contra-incendios en West Virginia, en el 88. Salió el sol. Todo el valle se prendió. No dije una palabra por una hora.",
        "Una playa en Maine a las cinco de la mañana, sola, a finales de septiembre. Los colores eran obscenos. He vuelto en sueños desde entonces.",
        "La plaza de la catedral de Florencia, en 1972, la única alma despierta. La piedra, esa mañana, era lavanda.",
      ],
    },
  },
  {
    id: 302,
    category: "stories",
    depth: "texture",
    en: "Was there a cab driver, bus driver, or stranger behind a wheel you remember?",
    es: "¿Hubo un taxista, conductor de autobús o desconocido al volante que recuerdes?",
    randomizeOptions: {
      en: [
        "Un taxista en La Habana. Me cantó un bolero entero hasta el aeropuerto. No me cobró. Yo tenía catorce.",
        "Cab driver in '01. Yelled scripture at the radio. I tipped him double.",
        "A bus driver who, on a snowy night in 2014, asked us all if we were warm enough. We were not, in fact. He turned the heat up.",
        "A driver in 1968 who, between fares, recited a fair amount of Wordsworth. I have not, since, taken a quieter cab.",
      ],
      es: [
        "Un taxista en La Habana. Me cantó un bolero entero hasta el aeropuerto. No me cobró. Yo tenía catorce.",
        "Taxista en el 01. Le gritaba escrituras al radio. Le di doble propina.",
        "Un chofer de autobús que, en una noche nevada de 2014, nos preguntó a todos si teníamos suficiente calor. No lo teníamos. Subió la calefacción.",
        "Un chofer en 1968 que, entre carreras, recitó una buena cantidad de Wordsworth. No he tomado, desde entonces, un taxi más callado.",
      ],
    },
  },
  {
    id: 303,
    category: "self",
    depth: "texture",
    en: "How does your handwriting look on a check, of all things?",
    es: "¿Cómo se ve tu letra en un cheque?",
    randomizeOptions: {
      en: [
        "Cuidadosa. Mami me dijo: 'el cheque es la firma de la persona.' Lo escribo despacio.",
        "Loose. Sloppy. Date abbreviated. Don't write many anymore.",
        "Carefully. I take pride in the date and the script of the amount. Almost no one writes checks anymore. I'm in no hurry to give up the practice.",
        "A formal cursive that has outlived the institution of the personal check by two decades. I write one a year, in defiance.",
      ],
      es: [
        "Cuidadosa. Mami me dijo: 'el cheque es la firma de la persona.' Lo escribo despacio.",
        "Suelta. Descuidada. Fecha abreviada. Ya no escribo muchos.",
        "Con cuidado. Me enorgullezco de la fecha y de la grafía de la cantidad. Casi nadie escribe cheques ya. No tengo prisa por abandonar la práctica.",
        "Una cursiva formal que ha sobrevivido a la institución del cheque personal por dos décadas. Escribo uno al año, en desafío.",
      ],
    },
  },
  {
    id: 304,
    category: "stories",
    depth: "depth",
    en: "Have you ever told a lie that you needed to tell? What was at stake?",
    es: "¿Alguna vez dijiste una mentira que necesitabas decir? ¿Qué estaba en juego?",
    randomizeOptions: {
      en: [
        "Le dije a mami que el doctor le había dicho que se iba a poner mejor. Era mentira. Pero ella necesitaba dormir esa noche. Dormimos las dos.",
        "Told my old man the cancer wasn't going to be much. Was a lot. He didn't need to know.",
        "Told a friend her work was good when it wasn't, the week her mother died. The truth could wait. I waited.",
        "I told a colleague, in 1987, that I had not heard a particular cruelty said about him. I had. I had heard it twice. He did not need it.",
      ],
      es: [
        "Le dije a mami que el doctor le había dicho que se iba a poner mejor. Era mentira. Pero ella necesitaba dormir esa noche. Dormimos las dos.",
        "Le dije a mi viejo que el cáncer no era mucho. Era mucho. No necesitaba saber.",
        "Le dije a una amiga que su trabajo estaba bueno cuando no lo estaba, la semana en que murió su mamá. La verdad podía esperar. Esperé.",
        "Le dije a un colega, en 1987, que no había oído cierta crueldad sobre él. La había oído. La había oído dos veces. Él no la necesitaba.",
      ],
    },
  },
  {
    id: 305,
    category: "place",
    depth: "texture",
    en: "Tell me about a piece of art — a painting, a sculpture, a poster — that lives in your house.",
    es: "Cuéntame de una pieza de arte — pintura, escultura, póster — que vive en tu casa.",
    randomizeOptions: {
      en: [
        "Un cuadro de la Virgen del Cobre que pintó mi tía. No es bueno. Es lo más bonito que tengo.",
        "Black-and-white photo of a '67 Mustang. Bought it at a flea market in '93. Hangs by the door.",
        "A small Hopper print I bought myself the year I turned thirty. The window in it is the window I want my life to feel like.",
        "A pencil sketch by a friend, since deceased, of the view from her studio. The sketch hangs by the door of mine.",
      ],
      es: [
        "Un cuadro de la Virgen del Cobre que pintó mi tía. No es bueno. Es lo más bonito que tengo.",
        "Foto en blanco y negro de un Mustang del 67. La compré en un mercado de pulgas en el 93. Cuelga junto a la puerta.",
        "Un pequeño grabado de Hopper que me compré el año que cumplí treinta. La ventana en él es la ventana a la que quiero que se sienta mi vida.",
        "Un esbozo a lápiz de una amiga, ya fallecida, de la vista desde su estudio. El esbozo cuelga junto a la puerta del mío.",
      ],
    },
  },
  {
    id: 306,
    category: "family",
    depth: "depth",
    en: "When did you know you'd be a parent — or that you wouldn't be?",
    es: "¿Cuándo supiste que ibas a ser padre — o que no lo serías?",
    randomizeOptions: {
      en: [
        "Cuando tenía siete años cargué a mi prima recién nacida. Ahí supe.",
        "Day my wife told me. Sat down. Got back up. Sat down again.",
        "I knew, at thirty-three, that I wasn't going to. The knowing arrived without theatre, like a small package on a porch.",
        "On a particular winter morning in 1969 I understood, with a quiet definiteness, that fatherhood would, in fact, be the ground of my life.",
      ],
      es: [
        "Cuando tenía siete años cargué a mi prima recién nacida. Ahí supe.",
        "El día que mi esposa me dijo. Me senté. Me paré. Me senté otra vez.",
        "Supe, a los treinta y tres, que no iba a ser. El saber llegó sin teatro, como un paquetito en un porche.",
        "Una mañana particular de invierno en 1969 comprendí, con tranquila certeza, que la paternidad sería, de hecho, el suelo de mi vida.",
      ],
    },
  },
  {
    id: 307,
    category: "self",
    depth: "texture",
    en: "What does your closet smell like when you open it?",
    es: "¿A qué huele tu clóset cuando lo abres?",
    randomizeOptions: {
      en: [
        "Lavanda. Le pongo bolsitas a la ropa. Mi mami lo hacía.",
        "Cedar and sweat. Don't open it for fun.",
        "Pressed cotton, faint coffee, my partner's wool coat. Home, in inventory form.",
        "Wool, leather, an old cologne, and the indistinct, dignified must of a household that has not, in years, modernized.",
      ],
      es: [
        "Lavanda. Le pongo bolsitas a la ropa. Mi mami lo hacía.",
        "Cedro y sudor. No lo abro por gusto.",
        "Algodón planchado, café leve, el abrigo de lana de mi pareja. Hogar, en forma de inventario.",
        "Lana, cuero, una vieja agua de colonia, y el indistinto, digno olor a viejo de una casa que no se ha, en años, modernizado.",
      ],
    },
  },
  {
    id: 308,
    category: "stories",
    depth: "depth",
    en: "If you could touch one moment again — not change it, just be inside it — which one?",
    es: "Si pudieras tocar un momento otra vez — no cambiarlo, sólo estar adentro — ¿cuál?",
    randomizeOptions: {
      en: [
        "La sobremesa con mami el último domingo. Café, plátano frito, novela en la tele. Eso. Otra vez.",
        "Sunday at the lake with my dad. I was nine. He laughed at something I said.",
        "A morning in my mid-thirties when I made coffee for someone I loved and the kitchen had a particular quality of light I have never since seen.",
        "A late afternoon in 1971, on a porch in Maine, with my late wife, who was, on that day, more entirely herself than at any other moment in our long life.",
      ],
      es: [
        "La sobremesa con mami el último domingo. Café, plátano frito, novela en la tele. Eso. Otra vez.",
        "Domingo en el lago con mi papá. Tenía nueve. Se rió de algo que dije.",
        "Una mañana en mis treinta y tantos cuando hice café para alguien que amaba y la cocina tenía cierta cualidad de luz que no he visto desde entonces.",
        "Una tarde tardía de 1971, en un porche en Maine, con mi difunta esposa, que estuvo, ese día, más enteramente ella misma que en cualquier otro momento de nuestra larga vida.",
      ],
    },
  },
  {
    id: 309,
    category: "love",
    depth: "texture",
    en: "Did a friendship start in a strange place — a waiting room, a wrong number, a bus?",
    es: "¿Una amistad empezó en un lugar raro — una sala de espera, un número equivocado, un autobús?",
    randomizeOptions: {
      en: [
        "En la guagua a Miami. Una señora me convidó a un caramelo. Treinta años somos comadres.",
        "Wrong number in '99. Lady kept calling. We talked for an hour. Christmas card every year since.",
        "A friend I met in line for a movie no one else was seeing. We have, in twelve years, never disagreed about a film.",
        "A correspondent reached, in 1971, by an erroneously addressed letter. We have, since, addressed each other every Wednesday.",
      ],
      es: [
        "En la guagua a Miami. Una señora me convidó un caramelo. Treinta años somos comadres.",
        "Número equivocado en el 99. La señora seguía llamando. Hablamos una hora. Tarjeta de Navidad cada año desde entonces.",
        "Un amigo que conocí en la fila de una película que nadie más veía. No hemos, en doce años, estado en desacuerdo sobre un filme.",
        "Un corresponsal alcanzado, en 1971, por una carta mal dirigida. Hemos, desde entonces, escrito mutuamente cada miércoles.",
      ],
    },
  },
  {
    id: 310,
    category: "stories",
    depth: "depth",
    en: "Have you had a near miss — health, accident, danger — that made you reconsider something?",
    es: "¿Has tenido un casi-accidente — salud, riesgo, peligro — que te hizo reconsiderar algo?",
    randomizeOptions: {
      en: [
        "Un susto del corazón a los sesenta. Cambié todo. Ya no aguantó pleitos. Solo amor o silencio.",
        "Got hit by a truck in '96. Walked away. Started saying 'I love you' on the phone after that.",
        "A car accident at twenty-eight from which I emerged unharmed and rearranged. The next year was, in retrospect, the one in which I became myself.",
        "A diagnosis, eventually retracted, in 1990, that nevertheless redirected my entire next decade. The redirection has, in balance, been the gift.",
      ],
      es: [
        "Un susto del corazón a los sesenta. Cambié todo. Ya no aguanto pleitos. Sólo amor o silencio.",
        "Me pegó una camioneta en el 96. Salí caminando. Empecé a decir 'te quiero' en el teléfono después de eso.",
        "Un accidente de carro a los veintiocho del que salí ilesa y reordenada. El año siguiente fue, en retrospectiva, en el que me convertí en mí.",
        "Un diagnóstico, eventualmente retractado, en 1990, que, sin embargo, redirigió mi década entera siguiente. La redirección ha sido, en balance, el regalo.",
      ],
    },
  },
  {
    id: 311,
    category: "place",
    depth: "texture",
    en: "Is there a chair you sat in once, somewhere, that you still remember?",
    es: "¿Hay una silla en la que te sentaste una vez, en algún lugar, que aún recuerdas?",
    randomizeOptions: {
      en: [
        "La silla del confesionario en La Habana. Tenía doce. Le confesé un crush al cura. Me dijo: 'mi hija, también el cura tuvo doce.'",
        "A Naugahyde booth at a diner in Akron. Talked to a stranger an hour. Never saw him again.",
        "A wooden chair in a stranger's kitchen in Spain in '08. We had no language. We had olives. The chair remembers me, I'm sure.",
        "A particular library chair in 1956, in which I read three pages of Yeats and rose, ninety minutes later, having become someone else.",
      ],
      es: [
        "La silla del confesionario en La Habana. Tenía doce. Le confesé un enamoramiento al cura. Me dijo: 'mi hija, el cura también tuvo doce.'",
        "Un asiento de Naugahyde en un restaurante en Akron. Platiqué con un desconocido una hora. Nunca lo volví a ver.",
        "Una silla de madera en la cocina de un desconocido en España en el 08. No teníamos idioma. Teníamos aceitunas. Estoy segura de que la silla me recuerda.",
        "Cierta silla de biblioteca en 1956, en la cual leí tres páginas de Yeats y me levanté, noventa minutos después, habiéndome convertido en otra persona.",
      ],
    },
  },
  {
    id: 312,
    category: "values",
    depth: "depth",
    en: "What's something you wish you'd protested out loud?",
    es: "¿Qué cosa quisieras haber protestado en voz alta?",
    randomizeOptions: {
      en: [
        "Cuando un tío habló mal de un gay en mi mesa. Yo callé. No callaré ya.",
        "When my coworker made the racist joke. Should've stood up. Didn't. Wouldn't make that mistake now.",
        "An unkindness done to a quieter friend at a dinner. I excused myself. I should have, instead, called the unkindness by its name.",
        "A particular silence in 1968 that I should have broken. The silence has, since, been louder than any word would have been.",
      ],
      es: [
        "Cuando un tío habló mal de un gay en mi mesa. Yo callé. Ya no callaré.",
        "Cuando mi compañero hizo el chiste racista. Debí pararme. No lo hice. Ya no cometería ese error.",
        "Una falta de bondad hecha a una amiga más callada en una cena. Me excusé. Debí, en cambio, llamar a la falta de bondad por su nombre.",
        "Cierto silencio en 1968 que debí haber roto. El silencio ha sido, desde entonces, más fuerte que cualquier palabra.",
      ],
    },
  },
  {
    id: 313,
    category: "self",
    depth: "texture",
    en: "What's a kitchen tool you'd grab if the house were on fire?",
    es: "¿Qué utensilio de cocina agarrarías si la casa se incendiara?",
    randomizeOptions: {
      en: [
        "El cuchillo de pelar de mami. Cabe en mi mano como si fuera mío. Lo es.",
        "Cast iron. Twelve inch. Got it from my old man.",
        "A wooden spoon my grandmother used. The handle is shaped to her grip; mine has, by now, accepted the same form.",
        "A small copper pot, of considerable age and even greater sentiment. The pot has outlived three kitchens.",
      ],
      es: [
        "El cuchillo de pelar de mami. Cabe en mi mano como si fuera mío. Lo es.",
        "Sartén de hierro fundido. Treinta centímetros. Era de mi viejo.",
        "Una cuchara de madera que usaba mi abuela. El mango tiene la forma de su agarre; el mío, a estas alturas, ha aceptado la misma forma.",
        "Una pequeña olla de cobre, de considerable edad y aún mayor sentimiento. La olla ha sobrevivido a tres cocinas.",
      ],
    },
  },
  {
    id: 314,
    category: "childhood",
    depth: "depth",
    en: "Is there a particular summer you remember as more vivid than the rest?",
    es: "¿Hay un verano particular que recuerdes más vívido que los demás?",
    randomizeOptions: {
      en: [
        "El verano de 1968 en Varadero. Mi prima Yoli. Mami todavía joven. Las cigarras. Esa luz.",
        "Summer of '79. Worked the boat. Slept in the truck. Was twenty. Was free.",
        "The summer between high school and college. The way the light fell, the friends I had, the books I read — they have, all four, lost focus only slightly.",
        "The summer of 1944, on the eve of departure. The corn was, that year, taller than anyone has, since, allowed it to grow in memory.",
      ],
      es: [
        "El verano de 1968 en Varadero. Mi prima Yoli. Mami todavía joven. Las cigarras. Esa luz.",
        "Verano del 79. Trabajé en el bote. Dormí en la camioneta. Tenía veinte. Era libre.",
        "El verano entre la prepa y la universidad. La forma en que caía la luz, los amigos que tuve, los libros que leí — los cuatro han perdido foco sólo un poco.",
        "El verano de 1944, en la víspera de la partida. El maíz estaba, ese año, más alto de lo que nadie ha permitido, desde entonces, que crezca en la memoria.",
      ],
    },
  },
  {
    id: 315,
    category: "self",
    depth: "texture",
    en: "Have you ever bought yourself flowers? When?",
    es: "¿Te has comprado flores a ti mismo? ¿Cuándo?",
    randomizeOptions: {
      en: [
        "Sí. Después de que se fue Hector. Cada viernes. No paro.",
        "Once. Wife was gone for a month. House felt empty. Bought daisies. Felt better.",
        "Last week. Tulips. Yellow. No reason. Sometimes the no-reason is the reason.",
        "Frequently, in fact. The flower stand near my office has, for nineteen years, supplied an alibi for my undignified affection for color.",
      ],
      es: [
        "Sí. Después de que se fue Hector. Cada viernes. No paro.",
        "Una vez. Mi esposa estuvo fuera un mes. La casa se sentía vacía. Compré margaritas. Me sentí mejor.",
        "La semana pasada. Tulipanes. Amarillos. Sin razón. A veces el sin-razón es la razón.",
        "Frecuentemente, de hecho. El puesto de flores cerca de mi oficina ha, durante diecinueve años, suministrado una coartada para mi indigna afección al color.",
      ],
    },
  },
  {
    id: 316,
    category: "self",
    depth: "depth",
    en: "What's something you carry with you all the time that no one else can see?",
    es: "¿Qué cargas contigo siempre que nadie más puede ver?",
    randomizeOptions: {
      en: [
        "El miedo de no ser suficiente. Lo cargo desde niña. Pero también la certeza de que sí lo soy.",
        "Picture of my dad in my head. Doesn't fade. Don't talk about him much.",
        "A line from a poem read at twenty-three that has, in some sense, been the through-line of my whole interior life.",
        "An unfinished apology. The recipient is, in fact, no longer available. I carry it as one carries an old key.",
      ],
      es: [
        "El miedo de no ser suficiente. Lo cargo desde niña. Pero también la certeza de que sí lo soy.",
        "Foto de mi papá en la cabeza. No se desvanece. No hablo mucho de él.",
        "Una línea de un poema leído a los veintitrés que ha sido, en cierto sentido, el hilo de mi vida interior.",
        "Una disculpa inconclusa. El destinatario ya no está, de hecho, disponible. La cargo como uno carga una llave vieja.",
      ],
    },
  },
  {
    id: 317,
    category: "childhood",
    depth: "texture",
    en: "Do you remember your phone number from when you were a kid?",
    es: "¿Recuerdas tu número de teléfono de cuando eras niño?",
    randomizeOptions: {
      en: [
        "Tres-uno-siete-ocho-cuatro. La voz de mami contestando: '¿Bueno?' Lo recuerdo así.",
        "555-3318. Lake number. Don't even know what area code that was.",
        "Yes — and the way the rotary dial felt slipping back. The number is no longer in service. The slip remains.",
        "BAyfield 7-3914. The exchange has, mercifully, been preserved in my memory if not in any operational sense.",
      ],
      es: [
        "Tres-uno-siete-ocho-cuatro. La voz de mami contestando: '¿Bueno?' Lo recuerdo así.",
        "555-3318. Número del lago. Ni sé qué área era.",
        "Sí — y cómo se sentía el disco giratorio resbalando de regreso. El número ya no opera. El resbalón queda.",
        "BAyfield 7-3914. La central ha, misericordiosamente, sobrevivido en mi memoria si no en ningún sentido operativo.",
      ],
    },
  },
  {
    id: 318,
    category: "stories",
    depth: "depth",
    en: "Did a teacher ever underestimate you? Did you ever tell them?",
    es: "¿Alguna vez un maestro te subestimó? ¿Se lo dijiste?",
    randomizeOptions: {
      en: [
        "Una maestra me dijo que no iba a ser nadie. Cuarenta años después la encontré. Le dije: 'soy la abuela que se acuerda de usted.' Y me reí.",
        "Algebra teacher said I was hopeless. Made foreman ten years later. Sent him a card. He didn't write back.",
        "An English professor at twenty who told me I had nothing to add. I have spent the years since adding. He has, mercifully, been forgotten.",
        "Yes; no. The vindication has been my own; the conversation, in retrospect, would not have improved it.",
      ],
      es: [
        "Una maestra me dijo que no iba a ser nadie. Cuarenta años después la encontré. Le dije: 'soy la abuela que se acuerda de usted.' Y me reí.",
        "El maestro de álgebra dijo que era caso perdido. Me hice capataz diez años después. Le mandé una tarjeta. No me contestó.",
        "Un profesor de inglés a los veinte que me dijo que no tenía nada que aportar. He pasado los años aportando. Él ha sido, misericordiosamente, olvidado.",
        "Sí; no. La vindicación ha sido mía; la conversación, en retrospectiva, no la habría mejorado.",
      ],
    },
  },
  {
    id: 319,
    category: "self",
    depth: "surface",
    en: "What do you say when you sit down hard, with relief?",
    es: "¿Qué dices cuando te sientas pesado, con alivio?",
    randomizeOptions: {
      en: [
        "'Aaay.' De los huesos. Mami lo decía igual.",
        "\"Oof.\" Just oof.",
        "An involuntary, ungrammatical sigh that my younger self would have found, frankly, embarrassing.",
        "\"Ah,\" with a small Latin postscript I shall not, in this venue, transcribe.",
      ],
      es: [
        "'Aaay.' De los huesos. Mami lo decía igual.",
        "\"Uf.\" Sólo uf.",
        "Un suspiro involuntario, agramatical, que mi yo más joven habría hallado, francamente, embarazoso.",
        "\"Ah,\" con una pequeña posdata en latín que no, en este foro, transcribiré.",
      ],
    },
  },
  {
    id: 320,
    category: "love",
    depth: "depth",
    en: "Was there a person who got away — not romantic necessarily, just someone who slipped out of your orbit?",
    es: "¿Hubo una persona que se te fue — no necesariamente romántica, alguien que se salió de tu órbita?",
    randomizeOptions: {
      en: [
        "Una amiga del barrio en La Habana. Salí. Ella se quedó. Nunca la volví a ver. Pienso en ella casi cada día.",
        "Cousin who moved to Texas. Lost touch. Found out he died. Found out late.",
        "A friend who was, for a year, the closest person to me. Then we both moved. We've meant to reconnect for thirteen years and haven't.",
        "A young protégé from the early eighties. The orbits, by sheer geographical accident, decoupled. We would, I think, still recognize one another.",
      ],
      es: [
        "Una amiga del barrio en La Habana. Yo salí. Ella se quedó. Nunca la volví a ver. Pienso en ella casi cada día.",
        "Un primo que se mudó a Texas. Perdimos el contacto. Supe que murió. Supe tarde.",
        "Una amiga que fue, por un año, la persona más cercana a mí. Después las dos nos mudamos. Hemos querido reconectarnos por trece años y no lo hemos hecho.",
        "Un joven aprendiz de principios de los ochenta. Las órbitas, por puro accidente geográfico, se desacoplaron. Nos reconoceríamos, creo, aún.",
      ],
    },
  },
  {
    id: 321,
    category: "stories",
    depth: "depth",
    en: "Tell me about a song that played at a funeral you attended.",
    es: "Cuéntame de una canción que sonó en un funeral al que asististe.",
    randomizeOptions: {
      en: [
        "'Ave María.' En el de mami. Yo no podía cantar. Mi hermana sí. Lo recuerdo en su voz.",
        "Amazing Grace at my old man's funeral. Bagpipes. Kid playing them couldn't have been twenty. Did him proud.",
        "A Mozart Requiem at a friend's. The sound, in that small church, was indecent in the best sense.",
        "The Dies Irae from the Mozart, at a colleague's. The room was, briefly, accommodated to the size of his life.",
      ],
      es: [
        "'Ave María.' En el de mami. Yo no podía cantar. Mi hermana sí. Lo recuerdo en su voz.",
        "Amazing Grace en el funeral de mi viejo. Gaitas. El niño que las tocaba no tenía ni veinte. Le hizo honor.",
        "Un Réquiem de Mozart en el de una amiga. El sonido, en esa iglesia chica, fue indecente en el mejor sentido.",
        "El Dies Irae de Mozart, en el de un colega. La sala fue, brevemente, acomodada al tamaño de su vida.",
      ],
    },
  },
  {
    id: 322,
    category: "stories",
    depth: "depth",
    en: "Did you ever lie to keep someone safe? What was at stake?",
    es: "¿Mentiste alguna vez para proteger a alguien? ¿Qué estaba en juego?",
    randomizeOptions: {
      en: [
        "A mami, sobre lo que pasaba en mi primer matrimonio. La hubiera matado el dolor. Me callé.",
        "Told the cops I didn't see anything. Lie. Saved a friend a charge he didn't deserve.",
        "I told a friend's mother that her daughter was at my apartment when she was, in fact, somewhere far less safe. The lie was, at that moment, the safer truth.",
        "Yes, in 1969, in a matter that I shall not, in any forum, describe. The lie has, in retrospect, been the most defensible sentence I ever uttered.",
      ],
      es: [
        "A mami, sobre lo que pasaba en mi primer matrimonio. La hubiera matado el dolor. Me callé.",
        "Le dije a la policía que no vi nada. Mentira. Le salvé a un cuate un cargo que no merecía.",
        "Le dije a la mamá de una amiga que su hija estaba en mi apartamento cuando estaba, de hecho, en un lugar mucho menos seguro. La mentira fue, en ese momento, la verdad más segura.",
        "Sí, en 1969, en un asunto que no describiré, en ningún foro. La mentira ha sido, en retrospectiva, la oración más defendible que jamás pronuncié.",
      ],
    },
  },
  {
    id: 323,
    category: "self",
    depth: "texture",
    en: "What do your bedsheets feel like? Soft, crisp, old, new?",
    es: "¿Cómo se sienten tus sábanas? ¿Suaves, planchadas, viejas, nuevas?",
    randomizeOptions: {
      en: [
        "Suaves. Planchadas. Lavanda en el armario. Mami me enseñó.",
        "Cotton. Wash 'em on Sunday. That's it.",
        "Crisp linen, hung dry. The bed is, after all, a small kind of sanctuary.",
        "Old, soft, slightly frayed at the hem, with a faint scent of lavender from the linen press.",
      ],
      es: [
        "Suaves. Planchadas. Lavanda en el armario. Mami me enseñó.",
        "Algodón. Las lavo los domingos. Eso es todo.",
        "Lino crujiente, secado al aire. La cama es, después de todo, una especie de pequeño santuario.",
        "Viejas, suaves, ligeramente deshilachadas en el dobladillo, con un leve aroma a lavanda de la cómoda de la ropa blanca.",
      ],
    },
  },
  {
    id: 324,
    category: "values",
    depth: "depth",
    en: "What have you outgrown about your faith — and what's still there?",
    es: "¿Qué has dejado atrás de tu fe — y qué sigue ahí?",
    randomizeOptions: {
      en: [
        "Dejé el miedo al infierno. Lo que queda: la convicción de que mami me sigue cuidando.",
        "Outgrew the church I was raised in. Didn't outgrow believing in something. Don't ask what.",
        "I have outgrown the certainty of any single doctrine. The instinct to bow my head, in the presence of what I do not understand, has remained.",
        "I have, after some decades, outgrown my objections to mystery. What remains is, in fact, mostly mystery.",
      ],
      es: [
        "Dejé el miedo al infierno. Lo que queda: la convicción de que mami me sigue cuidando.",
        "Dejé atrás la iglesia en la que me criaron. No dejé de creer en algo. No preguntes en qué.",
        "He dejado atrás la certeza de cualquier doctrina única. El instinto de inclinar la cabeza, ante lo que no entiendo, ha permanecido.",
        "He, después de algunas décadas, dejado atrás mis objeciones al misterio. Lo que queda es, de hecho, casi puro misterio.",
      ],
    },
  },
  {
    id: 325,
    category: "legacy",
    depth: "soul",
    en: "If you had to choose one sentence to be said about you — at a wake, in a memory, in a thought — what would it be?",
    es: "Si tuvieras que escoger una sola oración para ser dicha sobre ti — en un velorio, en una memoria, en un pensamiento — ¿cuál sería?",
    randomizeOptions: {
      en: [
        "'Ella nos quiso bien y nos hizo reír.' Eso es. Ya con eso me voy en paz.",
        "\"He was steady.\" That's enough.",
        "\"She paid attention.\" That's the whole sentence; that's the whole sentence I want.",
        "\"He was, on balance, a good listener.\" The phrase has dignity sufficient to outlast the speaker, and that is, by my measure, the highest compliment.",
      ],
      es: [
        "'Ella nos quiso bien y nos hizo reír.' Eso es. Con eso me voy en paz.",
        "\"Era firme.\" Es suficiente.",
        "\"Prestó atención.\" Es la oración entera; es la oración entera que quiero.",
        "\"Era, en balance, un buen escucha.\" La frase tiene dignidad suficiente para sobrevivir al hablante, y eso es, según mi medida, el cumplido más alto.",
      ],
    },
  },
];

export const totalQuestions = 355;
export const draftedQuestions = questions.length;
