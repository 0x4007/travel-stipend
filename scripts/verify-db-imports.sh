#!/bin/bash

# Colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Cleaning Up ===${NC}"
rm -f db/travel-stipend.db

echo -e "${BLUE}=== Reinitializing Database ===${NC}"
bun tests/reinitialize-db.ts

echo -e "${BLUE}\n=== Verifying Database Imports ===${NC}"

# Function to run SQL query and check results
check_table() {
    local table=$1
    local query=$2
    local expected_count=$3

    echo -e "\n${GREEN}Checking $table...${NC}"

    # Get row count
    count=$(sqlite3 db/travel-stipend.db "SELECT COUNT(*) FROM $table")
    echo "Row count: $count"

    if [ -n "$expected_count" ] && [ "$count" -lt "$expected_count" ]; then
        echo -e "${RED}Warning: Found only $count rows in $table (expected at least $expected_count)${NC}"
    fi

    # Show sample data
    echo -e "\nSample data:"
    sqlite3 db/travel-stipend.db ".mode column" ".headers on" "$query"
}

# Check Airport Codes
check_table "airport_codes" \
    "SELECT code, city, country, coordinates
     FROM airport_codes
     WHERE coordinates NOT LIKE '%undefined%'
     LIMIT 3;" \
    100

# Check Conferences
check_table "conferences" \
    "SELECT category, conference, location
     FROM conferences
     WHERE category NOT IN ('TRUE', 'FALSE')
     LIMIT 3;" \
    10

# Check Cost of Living
check_table "cost_of_living" \
    "SELECT city, cost_index
     FROM cost_of_living
     WHERE cost_index IS NOT NULL
     LIMIT 3;" \
    50

# Check Taxis
check_table "taxis" \
    "SELECT city, base_fare, per_km_rate, typical_trip_km
     FROM taxis
     WHERE base_fare > 0
     LIMIT 3;" \
    20

# Validation checks
echo -e "\n${BLUE}=== Running Validation Checks ===${NC}"

# Check for undefined in coordinates
undefined_coords=$(sqlite3 db/travel-stipend.db "SELECT COUNT(*) FROM airport_codes WHERE coordinates LIKE '%undefined%'")
if [ "$undefined_coords" -gt 0 ]; then
    echo -e "${RED}Error: Found $undefined_coords rows with 'undefined' in coordinates${NC}"
    echo "Sample problematic rows:"
    sqlite3 db/travel-stipend.db ".mode column" ".headers on" \
        "SELECT code, city, country, coordinates
         FROM airport_codes
         WHERE coordinates LIKE '%undefined%'
         LIMIT 3;"
fi

# Check for TRUE/FALSE in conference categories
invalid_categories=$(sqlite3 db/travel-stipend.db "SELECT COUNT(*) FROM conferences WHERE category IN ('TRUE', 'FALSE')")
if [ "$invalid_categories" -gt 0 ]; then
    echo -e "${RED}Error: Found $invalid_categories rows with TRUE/FALSE as categories${NC}"
    echo "Sample problematic rows:"
    sqlite3 db/travel-stipend.db ".mode column" ".headers on" \
        "SELECT category, conference, location
         FROM conferences
         WHERE category IN ('TRUE', 'FALSE')
         LIMIT 3;"
fi

# Check for zero cost indices
zero_costs=$(sqlite3 db/travel-stipend.db "SELECT COUNT(*) FROM cost_of_living WHERE cost_index = 0")
if [ "$zero_costs" -gt 0 ]; then
    echo -e "${RED}Error: Found $zero_costs rows with 0.0 cost index (should be NULL)${NC}"
    echo "Sample problematic rows:"
    sqlite3 db/travel-stipend.db ".mode column" ".headers on" \
        "SELECT city, cost_index
         FROM cost_of_living
         WHERE cost_index = 0
         LIMIT 3;"
fi

echo -e "\n${BLUE}=== Verification Complete ===${NC}"
