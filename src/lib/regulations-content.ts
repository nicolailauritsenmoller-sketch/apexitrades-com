// Canonical copy for the Regulated Internationally page.
// The page route and the footer link read from here so entity names,
// licence numbers and regulator references stay in one place.

import auFlag from "@/assets/flags/au.svg";
import caFlag from "@/assets/flags/ca.svg";
import euFlag from "@/assets/flags/eu.svg";
import gbFlag from "@/assets/flags/gb.svg";
import nzFlag from "@/assets/flags/nz.svg";
import usFlag from "@/assets/flags/us.svg";
import sgFlag from "@/assets/flags/sg.svg";
import zaFlag from "@/assets/flags/za.svg";

export type RegulationBadge = {
  name: string;
  detail: string;
};

export type RegulationJurisdiction = {
  id: string;
  country: string;
  flag: string;
  entity: string;
  summary: string;
  badges: RegulationBadge[];
};

export const REGULATIONS_PAGE = {
  title: "Regulated Internationally",
  eyebrow: "Compliance",
  subtitle:
    "Velocity Trade’s subsidiaries are regulated and licensed in their local jurisdictions.",
  lastUpdated: "14 November 2026",
  jurisdictions: [
    {
      id: "australia",
      country: "Australia",
      flag: auFlag,
      entity: "Velocity Trade Pty Ltd",
      summary:
        "Authorised financial services provider and exchange participant serving institutional and professional clients across Australian markets.",
      badges: [
        {
          name: "ASIC",
          detail:
            "Australian Securities and Investments Commission - Australian Financial Services Licence (AFSL) No. 329813.",
        },
        {
          name: "ASX",
          detail:
            "Australian Securities Exchange - market participant membership for exchange-traded products.",
        },
      ],
    },
    {
      id: "canada",
      country: "Canada",
      flag: caFlag,
      entity: "Velocity Trade Canada Inc.",
      summary:
        "Registered investment dealer serving clients in Alberta, British Columbia, Ontario, Manitoba and Quebec.",
      badges: [
        {
          name: "CIRO",
          detail:
            "Canadian Investment Regulatory Organization - investment dealer registration.",
        },
        {
          name: "CIPF",
          detail:
            "Canadian Investor Protection Fund - client account protection membership.",
        },
        {
          name: "TMX / Toronto Stock Exchange",
          detail: "Participating organization of the TMX and the Toronto Stock Exchange.",
        },
        {
          name: "FINTRAC",
          detail:
            "Registered with the Financial Transactions and Reports Analysis Centre of Canada as a money services business.",
        },
      ],
    },
    {
      id: "europe",
      country: "Europe",
      flag: euFlag,
      entity: "VTC Europe B.V.",
      summary:
        "European investment firm providing regulated brokerage services across the European Union.",
      badges: [
        {
          name: "AFM",
          detail:
            "Regulated by the Dutch Authority for the Financial Markets (Autoriteit Financiele Markten).",
        },
      ],
    },
    {
      id: "new-zealand",
      country: "New Zealand",
      flag: nzFlag,
      entity: "Velocity Trade New Zealand Ltd",
      summary:
        "Registered financial service provider offering broking and dealing services under New Zealand law.",
      badges: [
        {
          name: "FMA",
          detail:
            "Financial Service Provider FSP20003, supervised by the Financial Markets Authority.",
        },
      ],
    },
    {
      id: "south-africa",
      country: "South Africa",
      flag: zaFlag,
      entity: "Velocity Trade South Africa (Pty) Ltd",
      summary:
        "Licensed financial services provider and endorsed transfer and depository participant.",
      badges: [
        {
          name: "FSCA",
          detail:
            "Financial Sector Conduct Authority - Financial Services Provider (FSP) No. 43295.",
        },
        {
          name: "STRATE",
          detail:
            "STRATE endorsed Transfer Secretary and Depository participant for settlement services.",
        },
      ],
    },
    {
      id: "united-kingdom",
      country: "United Kingdom",
      flag: gbFlag,
      entity: "Velocity Trade UK Ltd",
      summary:
        "FCA-registered firm providing institutional brokerage and execution services from London.",
      badges: [
        {
          name: "FCA",
          detail: "Financial Conduct Authority - Registered Number 497263.",
        },
        {
          name: "Pillar 3 Disclosure",
          detail:
            "Publishes Pillar 3 regulatory capital and risk disclosures in line with prudential requirements.",
        },
        {
          name: "Modern Day Slavery Statement",
          detail:
            "Maintains a Modern Day Slavery Statement under the UK Modern Slavery Act.",
        },
      ],
    },
    {
      id: "singapore",
      country: "Singapore",
      flag: sgFlag,
      entity: "Velocity Trade Singapore Pte. Ltd.",
      summary:
        "Capital markets services provider for accredited and institutional investors in Singapore.",
      badges: [
        {
          name: "MAS",
          detail:
            "Capital Markets Services Licensee regulated by the Monetary Authority of Singapore.",
        },
      ],
    },
    {
      id: "united-states",
      country: "United States",
      flag: usFlag,
      entity: "Velocity Trade US entities",
      summary:
        "US operations conducted under applicable federal and state regulatory frameworks.",
      badges: [
        {
          name: "SEC / FINRA framework",
          detail:
            "US securities activities are conducted under the applicable SEC and FINRA regulatory frameworks.",
        },
        {
          name: "State compliance",
          detail:
            "State-level registrations and money transmission requirements are observed where services are offered.",
        },
      ],
    },
  ] as RegulationJurisdiction[],
};
