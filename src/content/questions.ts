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
];

export const totalQuestions = 355;
export const draftedQuestions = questions.length;
