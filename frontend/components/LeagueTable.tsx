import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface LeagueMember {
  userId: string;
  userName: string;
  userEmail?: string;
  rank: number | null;
  previousRank: number | null;
  rankChange: number;
  gameweekScore: number;
  totalScore: number;
  isNewMember: boolean;
  notYetParticipating?: boolean;
  calculatedAt?: Date;
  position?: "above" | "below"; // For current user outside page
}

interface LeagueTableProps {
  members: LeagueMember[];
  gameweek?: number;
  onMemberPress?: (member: LeagueMember) => void;
  loading?: boolean;
  emptyMessage?: string;
  currentUserEntry?: LeagueMember | null;
}

const LeagueTable: React.FC<LeagueTableProps> = ({
  members,
  gameweek,
  onMemberPress,
  loading = false,
  emptyMessage = "No league data available",
  currentUserEntry = null,
}) => {
  const renderPositionChange = (member: LeagueMember) => {
    // If user hasn't started participating yet, show nothing
    if (member.notYetParticipating) {
      return (
        <View style={styles.noChangeContainer}>
          <Text style={styles.notParticipatingText}>-</Text>
        </View>
      );
    }

    if (member.isNewMember) {
      return (
        <View style={styles.newMemberBadge}>
          <Text style={styles.newMemberText}>NEW</Text>
        </View>
      );
    }

    if (member.rankChange === 0) {
      return (
        <View style={styles.noChangeContainer}>
          <Ionicons name="remove" size={16} color="#6c757d" />
        </View>
      );
    }

    if (member.rankChange > 0) {
      // Moved up (positive change)
      return (
        <View style={styles.positionChange}>
          <Ionicons name="chevron-up" size={14} color="#28a745" />
          <Text style={styles.positionChangeTextUp}>+{member.rankChange}</Text>
        </View>
      );
    }

    // Moved down (negative change)
    return (
      <View style={styles.positionChange}>
        <Ionicons name="chevron-down" size={14} color="#dc3545" />
        <Text style={styles.positionChangeTextDown}>
          {Math.abs(member.rankChange)}
        </Text>
      </View>
    );
  };

  const getRankStyle = (rank: number | null | undefined) => {
    if (rank === null || rank === undefined) return styles.rankText;
    if (rank === 1) return [styles.rankText, styles.firstPlace];
    if (rank === 2) return [styles.rankText, styles.secondPlace];
    if (rank === 3) return [styles.rankText, styles.thirdPlace];
    return styles.rankText;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading league table...</Text>
      </View>
    );
  }

  if (members.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="trophy-outline" size={48} color="#6c757d" />
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  const renderMemberRow = (
    member: LeagueMember,
    index: number,
    isCurrentUser: boolean = false,
    isLast: boolean = false
  ) => (
    <TouchableOpacity
      key={member.userId}
      style={[
        styles.tableRow,
        isLast && styles.lastRow,
        isCurrentUser && styles.currentUserRow,
        member.notYetParticipating && styles.notParticipatingRow,
      ]}
      onPress={() => !member.notYetParticipating && onMemberPress?.(member)}
      activeOpacity={onMemberPress && !member.notYetParticipating ? 0.7 : 1}
      disabled={member.notYetParticipating}
    >
      {/* Rank */}
      <View style={styles.rankColumn}>
        <Text style={getRankStyle(member.rank)}>
          {member.rank !== null && member.rank !== undefined
            ? member.rank
            : "-"}
        </Text>
        {member.rank !== null &&
          member.rank !== undefined &&
          member.rank >= 1 &&
          member.rank <= 3 && (
            <View style={styles.medalContainer}>
              <Ionicons
                name="medal"
                size={12}
                color={
                  member.rank === 1
                    ? "#ffd700"
                    : member.rank === 2
                    ? "#c0c0c0"
                    : member.rank === 3
                    ? "#cd7f32"
                    : ""
                }
              />
            </View>
          )}
      </View>

      {/* Position Change */}
      <View style={styles.changeColumn}>{renderPositionChange(member)}</View>

      {/* Player Info */}
      <View style={styles.playerColumn}>
        <Text
          style={[styles.playerName, isCurrentUser && styles.currentUserText]}
          numberOfLines={1}
        >
          {member.userName} {isCurrentUser && "(You)"}
        </Text>
        {member.userEmail && (
          <Text style={styles.playerEmail} numberOfLines={1}>
            {member.userEmail}
          </Text>
        )}
      </View>

      {/* Gameweek Score */}
      {gameweek && (
        <View style={styles.gameweekColumn}>
          <Text style={styles.gameweekScore}>{member.gameweekScore}</Text>
        </View>
      )}

      {/* Total Score */}
      <View style={styles.totalColumn}>
        <Text style={styles.totalScore}>{member.totalScore}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Table Header */}
      <View style={styles.tableHeader}>
        <View style={styles.rankColumn}>
          <Text style={styles.headerText}>Pos</Text>
        </View>
        <View style={styles.changeColumn}>
          <Text style={styles.headerText}>Change</Text>
        </View>
        <View style={styles.playerColumn}>
          <Text style={styles.headerText}>Player</Text>
        </View>
        {gameweek && (
          <View style={styles.gameweekColumn}>
            <Text style={styles.headerText}>GW{gameweek}</Text>
          </View>
        )}
        <View style={styles.totalColumn}>
          <Text style={styles.headerText}>Total</Text>
        </View>
      </View>

      {/* Current User Entry - Above (if ranked higher than current page) */}
      {currentUserEntry && currentUserEntry.position === "above" && (
        <>
          {renderMemberRow(currentUserEntry, -1, true, false)}
          <View style={styles.separatorContainer}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>···</Text>
            <View style={styles.separatorLine} />
          </View>
        </>
      )}

      {/* Table Body */}
      <ScrollView style={styles.tableBody} showsVerticalScrollIndicator={false}>
        {members.map((member, index) =>
          renderMemberRow(
            member,
            index,
            false,
            index === members.length - 1 && !currentUserEntry?.position
          )
        )}

        {/* Current User Entry - Below (if ranked lower than current page) */}
        {currentUserEntry && currentUserEntry.position === "below" && (
          <>
            <View style={styles.separatorContainer}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>···</Text>
              <View style={styles.separatorLine} />
            </View>
            {renderMemberRow(currentUserEntry, members.length, true, true)}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowColor: "#000",
    overflow: "hidden",
  },
  loadingContainer: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#6c757d",
    fontWeight: "500",
  },
  emptyContainer: {
    padding: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#6c757d",
    marginTop: 12,
    textAlign: "center",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8f9fa",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
    alignItems: "center",
  },
  headerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#495057",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableBody: {
    maxHeight: 400,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f8f9fa",
    minHeight: 56,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  rankColumn: {
    width: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#495057",
  },
  firstPlace: {
    color: "#ffd700",
  },
  secondPlace: {
    color: "#c0c0c0",
  },
  thirdPlace: {
    color: "#cd7f32",
  },
  medalContainer: {
    position: "absolute",
    top: -2,
    right: -2,
  },
  changeColumn: {
    width: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  positionChange: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  noChangeContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  positionChangeTextUp: {
    fontSize: 12,
    color: "#28a745",
    fontWeight: "bold",
    marginLeft: 2,
  },
  positionChangeTextDown: {
    fontSize: 12,
    color: "#dc3545",
    fontWeight: "bold",
    marginLeft: 2,
  },
  newMemberBadge: {
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  newMemberText: {
    fontSize: 10,
    color: "#1976d2",
    fontWeight: "bold",
  },
  playerColumn: {
    flex: 1,
    marginLeft: 8,
    marginRight: 8,
  },
  playerName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#212529",
    marginBottom: 2,
  },
  playerEmail: {
    fontSize: 12,
    color: "#6c757d",
  },
  gameweekColumn: {
    width: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  gameweekScore: {
    fontSize: 14,
    fontWeight: "500",
    color: "#495057",
  },
  totalColumn: {
    width: 70,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  totalScore: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#212529",
  },
  // Current user styles
  currentUserRow: {
    backgroundColor: "#e3f2fd",
    borderLeftWidth: 3,
    borderLeftColor: "#007bff",
  },
  currentUserText: {
    color: "#007bff",
    fontWeight: "bold",
  },
  // Separator styles for "..." between current user and page content
  separatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#f8f9fa",
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#dee2e6",
  },
  separatorText: {
    fontSize: 16,
    color: "#6c757d",
    paddingHorizontal: 12,
    fontWeight: "bold",
  },
  // Not yet participating styles
  notParticipatingRow: {
    backgroundColor: "#f8f9fa",
    opacity: 0.7,
  },
  notParticipatingText: {
    fontSize: 14,
    color: "#6c757d",
    fontWeight: "600",
  },
});

export default LeagueTable;
