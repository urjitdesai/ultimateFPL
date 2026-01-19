# League Access Middleware

## Overview

The `leagueAccess.js` middleware provides security controls to ensure users can only access prediction data of other users who are in the same league(s) as them.

## Middleware Functions

### `verifySharedLeagueMembership`

**Purpose:** Ensures users can only view predictions of users they share a league with.

**Usage:**

```javascript
import { verifySharedLeagueMembership } from "../middleware/leagueAccess.js";

router.get(
  "/user/:userId/gameweek/:gameweek",
  authenticateToken,
  verifySharedLeagueMembership,
  controller.getUserPredictionsByUserId
);
```

**Security Checks:**

1. **Self-access:** Users can always access their own predictions
2. **League membership:** Requesting user must be in at least one league
3. **Target user existence:** Target user must exist and be in at least one league
4. **Shared leagues:** Both users must share at least one common league
5. **Input validation:** Validates user ID format and parameters

**Response Codes:**

- `200` - Access granted (continues to next middleware/controller)
- `400` - Invalid user ID format
- `403` - Access denied (no shared leagues or not in any leagues)
- `404` - Target user not found or not in any leagues
- `500` - Internal server error

**Security Features:**

- Comprehensive logging for security auditing
- Input validation to prevent injection attacks
- Detailed error messages for debugging (while avoiding information leakage)
- Adds shared league information to request object for controller use

### `verifyLeagueMembership`

**Purpose:** Checks if a user is a member of a specific league.

**Usage:**

```javascript
import { verifyLeagueMembership } from "../middleware/leagueAccess.js";

// Default parameter name is "leagueId"
router.get(
  "/league/:leagueId/data",
  authenticateToken,
  verifyLeagueMembership(),
  controller.getLeagueData
);

// Custom parameter name
router.get(
  "/custom/:customLeagueId/data",
  authenticateToken,
  verifyLeagueMembership("customLeagueId"),
  controller.getLeagueData
);
```

## Database Structure

The middleware relies on the `users_leagues` collection with the following structure:

```
users_leagues/{docId}
{
  userId: string,
  leagueId: string,
  joined_at: timestamp,
  joining_gameweek: number
}
```

## Security Considerations

### What's Protected

- Prevents unauthorized access to user prediction data
- Ensures league privacy and data isolation
- Logs all access attempts for security auditing

### What's Not Protected

- This middleware doesn't rate limit requests
- Doesn't prevent information enumeration attacks
- Doesn't validate prediction data integrity

### Best Practices

1. Always use with `authenticateToken` middleware first
2. Monitor logs for suspicious access patterns
3. Consider adding rate limiting for prediction endpoints
4. Regularly audit league membership data

## Error Handling

The middleware provides detailed error responses for debugging while being careful not to leak sensitive information:

- **403 errors** indicate authorization failures (no shared leagues)
- **404 errors** indicate the target user doesn't exist or isn't in leagues
- **500 errors** indicate system failures and are logged for investigation

## Integration with Controllers

Controllers can access additional information added by the middleware:

```javascript
const controller = (req, res) => {
  // Array of shared league IDs
  const sharedLeagues = req.sharedLeagues;

  // Use shared league info for additional filtering if needed
  console.log(`Users share ${sharedLeagues.length} leagues`);
};
```

## Testing

To test the middleware:

1. **Valid access:** Users in same league should be able to view each other's predictions
2. **Self access:** Users should always be able to view their own predictions
3. **Invalid access:** Users not in same leagues should receive 403 errors
4. **Non-existent users:** Requests for non-existent users should receive 404 errors
5. **Malformed requests:** Invalid user IDs should receive 400 errors
