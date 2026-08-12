<?php

namespace App\Http\Requests;

use App\Models\Database;
use App\Models\Server;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDatabaseUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $databaseId = $this->integer('database_id');
        $host = 'localhost';

        if ($databaseId > 0) {
            $database = Database::query()
                ->where('server_id', Server::current()->id)
                ->whereKey($databaseId)
                ->first();

            if ($database !== null) {
                $host = $database->userHost();
            }
        }

        return [
            'username' => [
                'required',
                'string',
                'max:32',
                'regex:/^[A-Za-z0-9_]{1,32}$/',
                Rule::unique('database_users', 'username')->where('host', $host),
            ],
            'database_id' => [
                'nullable',
                'integer',
                Rule::exists('databases', 'id')->where(
                    fn ($query) => $query->where('server_id', Server::current()->id),
                ),
            ],
            'privileges' => [
                'required_with:database_id',
                Rule::in(['all', 'readonly']),
            ],
        ];
    }
}
