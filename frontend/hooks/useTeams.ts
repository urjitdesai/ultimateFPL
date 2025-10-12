import { useState, useEffect } from "react";
import axios from "axios";

// Static team logo imports
const teamLogos: { [key: string]: any } = {
  "1": require("../assets/team-logos/1.png"),
  "2": require("../assets/team-logos/2.png"),
  "3": require("../assets/team-logos/3.png"),
  "4": require("../assets/team-logos/4.png"),
  "5": require("../assets/team-logos/5.png"),
  "6": require("../assets/team-logos/6.png"),
  "7": require("../assets/team-logos/7.png"),
  "8": require("../assets/team-logos/8.png"),
  "9": require("../assets/team-logos/9.png"),
  "10": require("../assets/team-logos/10.png"),
  "11": require("../assets/team-logos/11.png"),
  "12": require("../assets/team-logos/12.png"),
  "13": require("../assets/team-logos/13.png"),
  "14": require("../assets/team-logos/14.png"),
  "15": require("../assets/team-logos/15.png"),
  "16": require("../assets/team-logos/16.png"),
  "17": require("../assets/team-logos/17.png"),
  "18": require("../assets/team-logos/18.png"),
  "19": require("../assets/team-logos/19.png"),
  "20": require("../assets/team-logos/20.png"),
};

export interface Team {
  id: string;
  name: string;
  displayName: string;
}

export interface TeamsData {
  [key: string]: {
    name: string;
    displayName: string;
  };
}

export const useTeams = () => {
  const [teams, setTeams] = useState<TeamsData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/constants/teams`
      );

      if (response.data.success) {
        setTeams(response.data.data);
      } else {
        setError("Failed to fetch teams data");
      }
    } catch (err) {
      console.error("Error fetching teams:", err);
      setError("Failed to load teams");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const getTeamById = (teamId: string | number): Team | null => {
    const team = teams[teamId.toString()];
    if (!team) return null;

    return {
      id: teamId.toString(),
      name: team.name,
      displayName: team.displayName,
    };
  };

  const getTeamLogo = (teamId: string | number) => {
    const logoKey = teamId.toString();
    return teamLogos[logoKey] || null;
  };

  return {
    teams,
    loading,
    error,
    getTeamById,
    getTeamLogo,
    refetch: fetchTeams,
  };
};
