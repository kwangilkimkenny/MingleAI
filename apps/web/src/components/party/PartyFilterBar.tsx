"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import FilterListIcon from "@mui/icons-material/FilterList";
import ClearIcon from "@mui/icons-material/Clear";

export interface PartyFilters {
  theme?: string;
  location?: string;
  dateFrom?: string;
  dateTo?: string;
  ageMin?: number;
  ageMax?: number;
}

interface PartyFilterBarProps {
  filters: PartyFilters;
  onChange: (filters: PartyFilters) => void;
  themes?: string[];
  locations?: string[];
}

export default function PartyFilterBar({
  filters,
  onChange,
  themes = ["연애", "친구", "네트워킹", "취미"],
  locations = ["서울", "경기", "부산", "대구", "인천"],
}: PartyFilterBarProps) {
  const [expanded, setExpanded] = useState(false);

  const handleChange = (key: keyof PartyFilters, value: string | number | undefined) => {
    onChange({ ...filters, [key]: value || undefined });
  };

  const handleClear = () => {
    onChange({});
  };

  const hasFilters = Object.values(filters).some((v) => v !== undefined);

  return (
    <Box sx={{ mb: 3 }}>
      <Box display="flex" alignItems="center" gap={2} mb={1}>
        <Button
          startIcon={<FilterListIcon />}
          onClick={() => setExpanded(!expanded)}
          variant={expanded ? "contained" : "outlined"}
          size="small"
        >
          필터
        </Button>
        {hasFilters && (
          <IconButton size="small" onClick={handleClear}>
            <ClearIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <Collapse in={expanded}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
            },
            gap: 2,
            p: 2,
            bgcolor: "background.paper",
            borderRadius: 2,
            border: 1,
            borderColor: "divider",
          }}
        >
          <FormControl size="small" fullWidth>
            <InputLabel>테마</InputLabel>
            <Select
              value={filters.theme || ""}
              label="테마"
              onChange={(e) => handleChange("theme", e.target.value)}
            >
              <MenuItem value="">전체</MenuItem>
              {themes.map((theme) => (
                <MenuItem key={theme} value={theme}>
                  {theme}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>지역</InputLabel>
            <Select
              value={filters.location || ""}
              label="지역"
              onChange={(e) => handleChange("location", e.target.value)}
            >
              <MenuItem value="">전체</MenuItem>
              {locations.map((loc) => (
                <MenuItem key={loc} value={loc}>
                  {loc}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            type="date"
            label="시작일"
            value={filters.dateFrom || ""}
            onChange={(e) => handleChange("dateFrom", e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          <TextField
            size="small"
            type="date"
            label="종료일"
            value={filters.dateTo || ""}
            onChange={(e) => handleChange("dateTo", e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          <TextField
            size="small"
            type="number"
            label="최소 나이"
            value={filters.ageMin || ""}
            onChange={(e) =>
              handleChange("ageMin", e.target.value ? parseInt(e.target.value) : undefined)
            }
            inputProps={{ min: 18, max: 100 }}
            fullWidth
          />

          <TextField
            size="small"
            type="number"
            label="최대 나이"
            value={filters.ageMax || ""}
            onChange={(e) =>
              handleChange("ageMax", e.target.value ? parseInt(e.target.value) : undefined)
            }
            inputProps={{ min: 18, max: 100 }}
            fullWidth
          />
        </Box>
      </Collapse>
    </Box>
  );
}
