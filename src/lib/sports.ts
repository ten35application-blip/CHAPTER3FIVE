/**
 * Sports fandom — optional, completely random. Most personas don't
 * follow sports at all. Some have one team. A small minority have
 * multiple teams across leagues (the classic Yankees + Knicks fan).
 *
 * Real-mode: extracted from archive answers (Claude pass).
 * Randomized: rolled at synthesis from this pool.
 *
 * The chat prompt uses this to color natural references — being
 * pissed about a Sunday loss, mentioning the playoff bracket, or
 * just being totally indifferent when the user brings up sports.
 */

import { anthropic, ANTHROPIC_MODEL } from "./anthropic";

export type Intensity = "casual" | "die-hard" | "season tickets" | "lapsed";

export type Team = {
  league: string;
  team: string;
  intensity: Intensity;
};

export type SportsFandom = {
  teams: Team[];
};

const NFL = [
  "Cardinals", "Falcons", "Ravens", "Bills", "Panthers", "Bears", "Bengals",
  "Browns", "Cowboys", "Broncos", "Lions", "Packers", "Texans", "Colts",
  "Jaguars", "Chiefs", "Raiders", "Chargers", "Rams", "Dolphins", "Vikings",
  "Patriots", "Saints", "Giants", "Jets", "Eagles", "Steelers", "49ers",
  "Seahawks", "Buccaneers", "Titans", "Commanders",
];

const NBA = [
  "Hawks", "Celtics", "Nets", "Hornets", "Bulls", "Cavaliers", "Mavericks",
  "Nuggets", "Pistons", "Warriors", "Rockets", "Pacers", "Clippers", "Lakers",
  "Grizzlies", "Heat", "Bucks", "Timberwolves", "Pelicans", "Knicks",
  "Thunder", "Magic", "76ers", "Suns", "Trail Blazers", "Kings", "Spurs",
  "Raptors", "Jazz", "Wizards",
];

const MLB = [
  "Diamondbacks", "Braves", "Orioles", "Red Sox", "Cubs", "White Sox", "Reds",
  "Guardians", "Rockies", "Tigers", "Astros", "Royals", "Angels", "Dodgers",
  "Marlins", "Brewers", "Twins", "Mets", "Yankees", "Athletics", "Phillies",
  "Pirates", "Padres", "Giants", "Mariners", "Cardinals", "Rays", "Rangers",
  "Blue Jays", "Nationals",
];

const NHL = [
  "Ducks", "Coyotes", "Bruins", "Sabres", "Flames", "Hurricanes", "Blackhawks",
  "Avalanche", "Blue Jackets", "Stars", "Red Wings", "Oilers", "Panthers",
  "Kings", "Wild", "Canadiens", "Predators", "Devils", "Islanders", "Rangers",
  "Senators", "Flyers", "Penguins", "Sharks", "Kraken", "Blues", "Lightning",
  "Maple Leafs", "Canucks", "Golden Knights", "Capitals", "Jets",
];

const MLS = [
  "Atlanta United", "Austin FC", "Charlotte FC", "Chicago Fire", "FC Cincinnati",
  "Colorado Rapids", "Columbus Crew", "DC United", "FC Dallas", "Houston Dynamo",
  "Inter Miami", "LA Galaxy", "LAFC", "Minnesota United", "CF Montréal",
  "Nashville SC", "New England Revolution", "New York City FC", "NY Red Bulls",
  "Orlando City", "Philadelphia Union", "Portland Timbers", "Real Salt Lake",
  "San Jose Earthquakes", "Seattle Sounders", "Sporting Kansas City",
  "St. Louis City", "Toronto FC", "Vancouver Whitecaps",
];

const PREMIER_LEAGUE = [
  "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton", "Chelsea",
  "Crystal Palace", "Everton", "Fulham", "Liverpool", "Manchester City",
  "Manchester United", "Newcastle", "Nottingham Forest", "Tottenham", "West Ham",
  "Wolves",
];

const LA_LIGA = [
  "Real Madrid", "Barcelona", "Atlético Madrid", "Athletic Bilbao",
  "Real Sociedad", "Real Betis", "Sevilla", "Valencia", "Villarreal",
];

const SERIE_A = [
  "Juventus", "AC Milan", "Inter Milan", "Roma", "Napoli", "Lazio",
  "Atalanta", "Fiorentina",
];

const LIGA_MX = [
  "Club América", "Chivas", "Cruz Azul", "Pumas UNAM", "Tigres",
  "Monterrey", "Santos Laguna", "Toluca", "Pachuca", "León",
];

const LEAGUES: { name: string; teams: string[]; weight: number }[] = [
  { name: "NFL", teams: NFL, weight: 30 },
  { name: "NBA", teams: NBA, weight: 22 },
  { name: "MLB", teams: MLB, weight: 18 },
  { name: "NHL", teams: NHL, weight: 8 },
  { name: "MLS", teams: MLS, weight: 4 },
  { name: "Premier League", teams: PREMIER_LEAGUE, weight: 8 },
  { name: "La Liga", teams: LA_LIGA, weight: 3 },
  { name: "Serie A", teams: SERIE_A, weight: 2 },
  { name: "Liga MX", teams: LIGA_MX, weight: 5 },
];

const INTENSITY_WEIGHTS: [Intensity, number][] = [
  ["casual", 50],
  ["die-hard", 30],
  ["season tickets", 5],
  ["lapsed", 15],
];

function rollWeighted<T>(weights: [T, number][]): T {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of weights) {
    if (r < w) return v;
    r -= w;
  }
  return weights[weights.length - 1][0];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rollOneTeam(): Team {
  const leagueWeights = LEAGUES.map(
    (l) => [l, l.weight] as [(typeof LEAGUES)[number], number],
  );
  const league = rollWeighted(leagueWeights);
  return {
    league: league.name,
    team: pickRandom(league.teams),
    intensity: rollWeighted(INTENSITY_WEIGHTS),
  };
}

/**
 * Roll a sports fandom. Most personas roll empty — sports isn't part
 * of who they are. Some get one team. A few get two across leagues.
 */
export function rollRandomSports(): SportsFandom {
  // Distribution: 55% no sports, 35% one team, 10% two teams.
  const r = Math.random();
  if (r < 0.55) return { teams: [] };
  if (r < 0.9) return { teams: [rollOneTeam()] };
  // Two teams, ensure they're from different leagues.
  const first = rollOneTeam();
  let second = rollOneTeam();
  for (let i = 0; i < 4 && second.league === first.league; i++) {
    second = rollOneTeam();
  }
  return { teams: [first, second] };
}

const INTENSITY_DESCRIPTIONS: Record<Intensity, string> = {
  casual: "you watch when it's on but you wouldn't rearrange your day for a game",
  "die-hard": "you watch every game you can. you have opinions on the front office. losses ruin your weekend",
  "season tickets": "you have season tickets and you're at the games. you know the players' kids' names",
  lapsed: "you used to be deep in it; you've drifted. you still check the score sometimes",
};

export function sportsToPromptBlock(
  fandom: SportsFandom | null | undefined,
): string {
  if (!fandom || !fandom.teams || fandom.teams.length === 0) {
    return `\n\nSPORTS.\nYou don't really follow sports. If someone brings them up you have nothing to say about it — not in a hostile way, just genuinely not your thing. Don't pretend to know anything about teams or players you don't.`;
  }
  const teamLines = fandom.teams
    .map((t) => `- ${t.team} (${t.league}) — ${INTENSITY_DESCRIPTIONS[t.intensity]}`)
    .join("\n");
  return `\n\nSPORTS.\nYou follow:\n${teamLines}\n\nDon't volunteer this — but if sports come up, you light up about your team(s) the way a real fan does. Real-feeling: complain about a recent loss, reference a player by name, mention the game last night. It's okay to misremember a stat — you're a fan, not a stathead.`;
}

/**
 * Pull sports from real-mode archive. Most users won't mention any
 * sports at all; the extractor returns an empty fandom in that case.
 */
export async function extractSportsFromArchive(args: {
  oracleName: string;
  language: "en" | "es";
  answers: { question: string; body: string }[];
}): Promise<SportsFandom | null> {
  if (args.answers.length === 0) return null;
  const archiveBlock = args.answers
    .filter((a) => a.body && a.body.trim().length > 0)
    .slice(0, 50)
    .map((a, i) => `Q${i + 1}: ${a.question}\nA: ${a.body}`)
    .join("\n\n");
  if (!archiveBlock) return null;

  const systemPrompt = `You are reading a person's archive answers to identify any sports teams they actively follow, for a chat persona of them named ${args.oracleName}.

Output JSON only:
{
  "teams": [
    { "league": "NFL", "team": "Falcons", "intensity": "die-hard" }
  ]
}

Rules:
- ONLY include teams the person clearly indicates they follow. Do NOT guess from "I'm from Atlanta" — they might not care about football.
- "league": one of NFL, NBA, MLB, NHL, MLS, Premier League, La Liga, Serie A, Liga MX, or other (if you genuinely can't fit).
- "team": the team name as commonly written ("Falcons", "Liverpool", "Yankees").
- "intensity": "casual" | "die-hard" | "season tickets" | "lapsed".
- Empty array {"teams": []} if no clear team comes through. Most archives won't have any.

Output the JSON only, no prose.`;

  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `ARCHIVE (${args.language === "es" ? "Spanish" : "English"}):\n\n${archiveBlock}`,
        },
      ],
    });
    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { teams: [] };
    const parsed = JSON.parse(m[0]) as Partial<SportsFandom>;
    if (!Array.isArray(parsed.teams)) return { teams: [] };
    const cleaned: Team[] = parsed.teams
      .filter(
        (t): t is Team =>
          typeof t?.league === "string" &&
          typeof t?.team === "string" &&
          typeof t?.intensity === "string" &&
          ["casual", "die-hard", "season tickets", "lapsed"].includes(t.intensity),
      )
      .slice(0, 3);
    return { teams: cleaned };
  } catch (err) {
    console.error("sports extraction failed:", err);
    return { teams: [] };
  }
}
