/**
 * The 355 questions that make up chapter3five.
 *
 * Each question carries:
 *   - en/es: the prompt text in both languages
 *   - randomizeOptions.en/es: four pre-written answers per question. When a
 *     user picks "Randomize" at onboarding, the server selects one of the
 *     four PERSONA INDEXES (0..3) and copies that index's answer for every
 *     question into the user's archive. Index identity is consistent across
 *     all questions: persona 0 is the same character throughout, etc.
 *
 * Persona archetypes (kept consistent across every question):
 *   0 — Marisol, 72, Cuban-American grandmother. Warm, affectionate, faith
 *       and family. Texts are short and tender. Often uses "mi amor" energy.
 *   1 — Daniel, 48, midwestern, blue-collar, dry humor. Terse texts, can be
 *       tender beneath the brusqueness.
 *   2 — Yuki, 28, urban designer, queer, sensitive, reads a lot. Texts can
 *       be longer and reflective.
 *   3 — Henry, 81, retired professor, witty, philosophical, charming with
 *       words. Texts are wordier and slightly archaic.
 *
 * Spanish translations are first-pass and need native review by region.
 *
 * Goal: 355 questions × 4 options × 2 languages. Currently drafted: 50.
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

export type Question = {
  id: number;
  category: Category;
  depth: Depth;
  en: string;
  es: string;
  randomizeOptions: {
    en: [string, string, string, string];
    es: [string, string, string, string];
  };
};

export const PERSONA_COUNT = 4;

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
];

export const totalQuestions = 355;
export const draftedQuestions = questions.length;
