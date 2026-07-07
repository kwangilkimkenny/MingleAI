import { IsString, IsNotEmpty } from "class-validator";

export class SelectCourseDto {
  @IsString()
  @IsNotEmpty()
  courseId!: string;
}
