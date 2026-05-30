import { PLAYABLE_WORLD_TEAM_NAMES, resolveWorldCupTeamName } from './teamCatalog.js';

export const STARTING_LINEUP_ROLES = {
  '4-4-2': ['GK', 'RB', 'RCB', 'LCB', 'LB', 'RM', 'RCM', 'LCM', 'LM', 'ST', 'ST'],
  '4-3-3': ['GK', 'RB', 'RCB', 'LCB', 'LB', 'DM', 'RCM', 'LCM', 'RW', 'ST', 'LW'],
  '4-2-3-1': ['GK', 'RB', 'RCB', 'LCB', 'LB', 'RDM', 'LDM', 'RW', 'AM', 'LW', 'ST'],
  '3-5-2': ['GK', 'RCB', 'CB', 'LCB', 'RWB', 'RCM', 'DM', 'LCM', 'LWB', 'ST', 'ST'],
  '3-4-3': ['GK', 'RCB', 'CB', 'LCB', 'RM', 'RCM', 'LCM', 'LM', 'RW', 'ST', 'LW'],
};

const SHIRT_NUMBERS = [1, 2, 5, 4, 3, 6, 8, 10, 7, 9, 11];

const NAME_STYLES = {
  northAmerican: {
    first: ['Logan', 'Evan', 'Miles', 'Caleb', 'Noah', 'Owen', 'Carter', 'Mason', 'Julian', 'Wyatt', 'Theo', 'Isaac'],
    last: ['Hale', 'Brooks', 'Turner', 'Hayes', 'Bennett', 'Reed', 'Coleman', 'Foster', 'Miller', 'West', 'Parker', 'Griffin'],
  },
  mexican: {
    first: ['Mateo', 'Emiliano', 'Santiago', 'Diego', 'Tomas', 'Javier', 'Rafael', 'Leonel', 'Hector', 'Bruno', 'Marco', 'Andres'],
    last: ['Alvarado', 'Cervantes', 'Ruelas', 'Montiel', 'Salcedo', 'Ibarra', 'Pineda', 'Noriega', 'Barragan', 'Farias', 'Ochoa', 'Zarate'],
  },
  spanish: {
    first: ['Adrian', 'Iker', 'Hugo', 'Nico', 'Alvaro', 'Pablo', 'Ruben', 'Martin', 'Sergio', 'Unai', 'Dario', 'Cesar'],
    last: ['Aranda', 'Vidal', 'Soler', 'Merino', 'Carrasco', 'Linares', 'Beltran', 'Santos', 'Molina', 'Navas', 'Ramos', 'Delgado'],
  },
  portuguese: {
    first: ['Tiago', 'Rui', 'Andre', 'Diogo', 'Nuno', 'Joao', 'Bruno', 'Miguel', 'Dinis', 'Leandro', 'Tomas', 'Marco'],
    last: ['Coelho', 'Moreira', 'Barbosa', 'Figueira', 'Esteves', 'Loureiro', 'Pereira', 'Amaral', 'Fonseca', 'Teixeira', 'Matos', 'Ribeiro'],
  },
  germanic: {
    first: ['Lukas', 'Jonas', 'Felix', 'Niklas', 'Leon', 'Timo', 'Mats', 'Emil', 'Julian', 'Oskar', 'Benedikt', 'Florian'],
    last: ['Keller', 'Vogel', 'Brandt', 'Weber', 'Kruger', 'Schreiber', 'Hartmann', 'Bauer', 'Fischer', 'Adler', 'Sommer', 'Berger'],
  },
  dutch: {
    first: ['Daan', 'Joris', 'Lars', 'Sem', 'Milan', 'Bram', 'Ruben', 'Tijs', 'Koen', 'Niels', 'Jasper', 'Luuk'],
    last: ['Van Dalen', 'De Wit', 'Bakker', 'Vermeer', 'Smit', 'Bosman', 'Kuipers', 'Mulder', 'Veldman', 'Koster', 'Hendriks', 'Vos'],
  },
  nordic: {
    first: ['Erik', 'Oskar', 'Noah', 'Emil', 'Henrik', 'Lars', 'Axel', 'Mikkel', 'Soren', 'Magnus', 'Viktor', 'Leif'],
    last: ['Berg', 'Lund', 'Nygaard', 'Solheim', 'Hansen', 'Svensson', 'Johansson', 'Aas', 'Nilsen', 'Lindholm', 'Strand', 'Holm'],
  },
  british: {
    first: ['Archie', 'Harry', 'Lewis', 'Oliver', 'Elliot', 'Finley', 'Jude', 'Callum', 'Connor', 'Rhys', 'Alfie', 'Max'],
    last: ['Whitaker', 'Bennett', 'Hughes', 'Fletcher', 'Harrison', 'Maddox', 'Walsh', 'Carter', 'Ellis', 'Shaw', 'Barker', 'Reid'],
  },
  slavic: {
    first: ['Luka', 'Ivan', 'Marko', 'Niko', 'Filip', 'Dario', 'Milan', 'Tomas', 'Jakub', 'Matej', 'Viktor', 'Stefan'],
    last: ['Kovac', 'Novak', 'Horvat', 'Petrovic', 'Maric', 'Vidovic', 'Bartos', 'Kral', 'Jelinek', 'Varga', 'Dragan', 'Kolar'],
  },
  turkish: {
    first: ['Emir', 'Kaan', 'Arda', 'Mert', 'Efe', 'Kerem', 'Ozan', 'Baris', 'Yusuf', 'Deniz', 'Burak', 'Turan'],
    last: ['Demir', 'Yilmaz', 'Kaya', 'Aydin', 'Celik', 'Aslan', 'Erdem', 'Sahin', 'Arslan', 'Kurt', 'Yildiz', 'Topal'],
  },
  italian: {
    first: ['Marco', 'Luca', 'Enzo', 'Dario', 'Nico', 'Fabio', 'Matteo', 'Gino', 'Paolo', 'Rocco', 'Sandro', 'Tomaso'],
    last: ['Rinaldi', 'Ferraro', 'Conti', 'Bellini', 'Rossetti', 'Marchetti', 'Grassi', 'Vitale', 'Moretti', 'Bianchi', 'Serra', 'Lombardi'],
  },
  southAmerican: {
    first: ['Mateo', 'Lautaro', 'Nicolas', 'Facundo', 'Joaquin', 'Tomas', 'Ignacio', 'Bruno', 'Franco', 'Thiago', 'Elias', 'Martin'],
    last: ['Arias', 'Benitez', 'Cardozo', 'Farias', 'Medina', 'Quiroga', 'Rojas', 'Vega', 'Acosta', 'Silva', 'Mendoza', 'Pereyra'],
  },
  brazilian: {
    first: ['Caio', 'Rafael', 'Bruno', 'Lucas', 'Thiago', 'Felipe', 'Vitor', 'Gustavo', 'Danilo', 'Renan', 'Marcos', 'Leo'],
    last: ['Almeida', 'Barros', 'Nogueira', 'Peixoto', 'Moura', 'Tavares', 'Lima', 'Costa', 'Ribeiro', 'Ferreira', 'Duarte', 'Pires'],
  },
  westAfrican: {
    first: ['Kofi', 'Amadou', 'Moussa', 'Ibra', 'Saliou', 'Yao', 'Kwame', 'Issa', 'Mamadou', 'Ousmane', 'Karim', 'Basile'],
    last: ['Diallo', 'Mensah', 'Traore', 'Sarr', 'Kone', 'Ba', 'Ndiaye', 'Toure', 'Cisse', 'Coulibaly', 'Diop', 'Kouame'],
  },
  northAfrican: {
    first: ['Youssef', 'Karim', 'Amine', 'Nadir', 'Sofiane', 'Mehdi', 'Ilyas', 'Adel', 'Rami', 'Walid', 'Samir', 'Omar'],
    last: ['Bensaid', 'Haddad', 'Mansouri', 'Cherif', 'Ziani', 'Boukari', 'Rahmani', 'El Amrani', 'Khelifi', 'Sahli', 'Naceri', 'Belkacem'],
  },
  arabic: {
    first: ['Omar', 'Yazan', 'Tariq', 'Fahad', 'Khalid', 'Nasser', 'Hamad', 'Zaid', 'Sami', 'Ali', 'Majed', 'Rayan'],
    last: ['Al Naimi', 'Al Harbi', 'Al Rashid', 'Al Saleh', 'Al Mansour', 'Al Qadi', 'Al Farsi', 'Al Khalaf', 'Al Jaber', 'Al Tamimi', 'Al Sayed', 'Al Haddad'],
  },
  eastAsian: {
    first: ['Min-jun', 'Ji-ho', 'Seo-jun', 'Hyun-woo', 'Daichi', 'Haruto', 'Ren', 'Takumi', 'Yuto', 'Kaito', 'Sota', 'Riku'],
    last: ['Kim', 'Park', 'Lee', 'Choi', 'Jung', 'Tanaka', 'Sato', 'Kobayashi', 'Nakamura', 'Ito', 'Mori', 'Hayashi'],
  },
  centralAsian: {
    first: ['Aziz', 'Jasur', 'Bekzod', 'Temur', 'Sardor', 'Rustam', 'Eldor', 'Otabek', 'Farrukh', 'Islom', 'Diyor', 'Kamol'],
    last: ['Karimov', 'Tursunov', 'Rakhimov', 'Nazarov', 'Yuldashev', 'Saidov', 'Usmonov', 'Kadyrov', 'Sobirov', 'Mirzaev', 'Akramov', 'Kurbanov'],
  },
  oceanic: {
    first: ['Lachlan', 'Cooper', 'Finn', 'Isaac', 'Blake', 'Rhys', 'Arlo', 'Ethan', 'Noah', 'Kai', 'Hemi', 'Tane'],
    last: ['Wilson', 'Fraser', 'Murray', 'Campbell', 'Reid', 'Walker', 'Taylor', 'McKenzie', 'Foster', 'King', 'Rangi', 'Tui'],
  },
  caribbean: {
    first: ['Jean', 'Mikael', 'Ruben', 'Dario', 'Jules', 'Ronaldo', 'Evens', 'Kervin', 'Thierry', 'Marvin', 'Jairo', 'Lenox'],
    last: ['Martis', 'Jean-Baptiste', 'Pierre', 'Celestine', 'Lafleur', 'Bernard', 'Marcelin', 'Anselm', 'Martina', 'Rombley', 'Joseph', 'Etienne'],
  },
};

const TEAM_NAME_STYLE = {
  Canada: 'northAmerican',
  Mexico: 'mexican',
  'United States': 'northAmerican',
  Austria: 'germanic',
  Belgium: 'dutch',
  'Bosnia and Herzegovina': 'slavic',
  Croatia: 'slavic',
  Czechia: 'slavic',
  England: 'british',
  France: 'spanish',
  Germany: 'germanic',
  Netherlands: 'dutch',
  Norway: 'nordic',
  Portugal: 'portuguese',
  Scotland: 'british',
  Spain: 'spanish',
  Sweden: 'nordic',
  Switzerland: 'germanic',
  Türkiye: 'turkish',
  Argentina: 'southAmerican',
  Brazil: 'brazilian',
  Colombia: 'southAmerican',
  Ecuador: 'southAmerican',
  Paraguay: 'southAmerican',
  Uruguay: 'southAmerican',
  Algeria: 'northAfrican',
  'Cabo Verde': 'portuguese',
  "Côte d'Ivoire": 'westAfrican',
  'DR Congo': 'westAfrican',
  Egypt: 'northAfrican',
  Ghana: 'westAfrican',
  Morocco: 'northAfrican',
  Senegal: 'westAfrican',
  'South Africa': 'westAfrican',
  Tunisia: 'northAfrican',
  Australia: 'oceanic',
  Iran: 'arabic',
  Iraq: 'arabic',
  Japan: 'eastAsian',
  Jordan: 'arabic',
  Qatar: 'arabic',
  'Saudi Arabia': 'arabic',
  'South Korea': 'eastAsian',
  Uzbekistan: 'centralAsian',
  Curaçao: 'caribbean',
  Haiti: 'caribbean',
  Panama: 'mexican',
  'New Zealand': 'oceanic',
  'Italy 1982': 'italian',
  'West Germany 1982': 'germanic',
};

function stableHash(value) {
  let hash = 0;
  for (const char of String(value)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

export function getWorldTeamStartingLineup(teamName, formation = '4-3-3') {
  const canonical = resolveWorldCupTeamName(teamName) || teamName;
  const styleKey = TEAM_NAME_STYLE[canonical] || 'northAmerican';
  const style = NAME_STYLES[styleKey] || NAME_STYLES.northAmerican;
  const roles = STARTING_LINEUP_ROLES[formation] || STARTING_LINEUP_ROLES['4-3-3'];
  const offset = stableHash(canonical);

  return roles.map((role, index) => {
    const first = style.first[(index + offset) % style.first.length];
    const last = style.last[(index * 3 + offset) % style.last.length];
    return {
      id: `${canonical}-${formation}-${index + 1}`,
      number: SHIRT_NUMBERS[index],
      role,
      name: `${first} ${last}`,
      team: PLAYABLE_WORLD_TEAM_NAMES.includes(canonical) ? canonical : teamName,
      synthetic: true,
    };
  });
}
